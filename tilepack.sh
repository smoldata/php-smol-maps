#!/bin/bash

# tilepack.sh by @dphiffer
# A shell script wrapper for the tilepack Python utility.
# All credit to @iandees for doing the hard part.
#
# Usage: tilepack.sh path/to/tiles
# 1. Looks for path/to/tiles/tiles.json config, generates one if none is found
# 2. Uses a Who's On First ID to determine lat/lon bounding box and downloads
#    tiles in mvt, topojson, terrain formats
# 3. Merges multiple WOF IDs into a common folder structure, separated by format
#
# See also: https://github.com/tilezen/tilepacks

DEPS="curl jq python rsync unzip"
for CMD in $DEPS ; do
	command -v "$CMD" >/dev/null 2>&1 || { echo "Please install $CMD." >&2; exit 1; }
done

if [ -z "$1" ] ; then
	echo "Usage: tilepack.sh path/to/tiles"
	exit 1
elif [ `echo $1 | cut -c1` == "/" ] ; then
	TILES_DIR=$1
else
	TILES_DIR="$(pwd)/$1"
fi

WHOAMI=`python -c 'import os, sys; print os.path.realpath(sys.argv[1])' $0`
DIR=`dirname $WHOAMI`
TILES_JSON="$TILES_DIR/tiles.json"
TILEPACKS_URL="https://github.com/tilezen/tilepacks/archive/master.zip"
FORMATS="mvt topojson terrain"

mkdir -p $TILES_DIR

if [ ! -f "$TILES_JSON" ] ; then
	while [[ ! $MAPZEN_API_KEY =~ ^[a-z]+-[a-zA-Z0-9]+$ ]] ; do
		echo "Mapzen API key"
		echo "Register here: https://mapzen.com/dashboard"
		echo -n "> "
		read MAPZEN_API_KEY
		if [[ ! $MAPZEN_API_KEY =~ ^[a-z]+-[a-zA-Z0-9]+$ ]] ; then
			echo "Please enter a valid Mapzen API key"
		fi
	done

	while [[ ! $WOF_ID =~ ^[0-9]+$ ]] ; do
		echo "Who's On First ID of the area you wish to download"
		echo "Search here: https://whosonfirst.mapzen.com/spelunker"
		echo -n "> "
		read WOF_ID

		if [[ ! $WOF_ID =~ ^[0-9]+$ ]] ; then
			echo "Please enter a valid WOF ID (numeric)"
		fi

		WOF_JSON="$TILES_DIR/$WOF_ID.json"

		if [ ! -f $WOF_JSON ] ; then
			API_URL="https://whosonfirst-api.mapzen.com/?api_key=$MAPZEN_API_KEY&method=whosonfirst.places.getInfo&id=$WOF_ID&extras=geom:bbox"
			curl -s -o $WOF_JSON $API_URL
		fi

		WOF_NAME=`jq -r '.place["wof:name"]' $WOF_JSON`

		if [ "$WOF_NAME" == "null" ] ; then
			echo "Could not find WOF ID $WOF_ID"
			WOF_ID=""
		else
			echo "Using $WOF_NAME ($WOF_ID)"
		fi
	done

	while [[ ! $MIN_ZOOM =~ ^[0-9]+$ ]] ; do
		echo "Minimum zoom level (0-20)"
		echo -n "[default 11]> "
		read MIN_ZOOM
		if [ "$MIN_ZOOM" == "" ] ; then
			MIN_ZOOM=11
			echo "Using minimum zoom: 11"
		elif [[ ! $MIN_ZOOM =~ ^[0-9]+$ ]] ; then
			echo "Please enter a number 0-20 (press enter to use default of 11)"
		fi
	done

	while [[ ! $MAX_ZOOM =~ ^[0-9]+$ ]] ; do
		echo "Maximum zoom level (0-20)"
		echo -n "[default 17]> "
		read MAX_ZOOM
		if [ "$MAX_ZOOM" == "" ] ; then
			MAX_ZOOM=17
			echo "Using maximum zoom: 17"
		elif [[ ! $MAX_ZOOM =~ ^[0-9]+$ ]] ; then
			echo "Please enter a number 0-20 (press enter to use default of 17)"
		fi
	done

	cat <<- EOF > "$TILES_JSON"
	{
	    "mapzen_api_key": "$MAPZEN_API_KEY",
	    "wof_ids": [$WOF_ID],
	    "min_zoom": $MIN_ZOOM,
	    "max_zoom": $MAX_ZOOM,
	    "formats": {
	        "mvt": {
	            "tilepack_args": "--type=vector --tile-format=mvt",
	            "layer": "all"
	        },
	        "topojson": {
	            "tilepack_args": "--type=vector --tile-format=topojson",
	            "layer": "all"
	        },
	        "terrain": {
	            "tilepack_args": "--type=terrain --layer=normal --tile-format=png",
	            "layer": "normal"
	        }
	    },
		"sources": {
	        "bubble-wrap": {
	            "mapzen": {
	                "type": "MVT",
	                "url": "/tiles/mvt/{z}/{x}/{y}.mvt",
	                "max_zoom": 16
	            }
	        },
	        "refill": {
	            "mapzen": {
	                "type": "TopoJSON",
	                "url": "/tiles/topojson/{z}/{x}/{y}.topojson",
	                "max_zoom": 16
	            }
	        },
	        "walkabout": {
	            "mapzen": {
	                "type": "MVT",
	                "url": "/tiles/mvt/{z}/{x}/{y}.mvt",
	                "rasters": ["normals"],
	                "max_zoom": 16
	            },
	            "normals": {
	                "type": "Raster",
	                "url": "/tiles/terrain/{z}/{x}/{y}.png",
	                "max_zoom": 15
	            }
	        }
	    }
	}
	EOF
fi

if [ ! -d "tilepacks" ] ; then
	cd $DIR
	curl -o tilepacks.zip -Ls $TILEPACKS_URL
	unzip -q tilepacks.zip
	rm tilepacks.zip
	mv tilepacks-master tilepacks
	cd $DIR/tilepacks
	virtualenv -p python3 env
	source env/bin/activate
	pip install -e .
else
	cd $DIR/tilepacks
	source env/bin/activate
fi

export MAPZEN_API_KEY=`jq -r ".mapzen_api_key" $TILES_JSON`
WOF_IDS=`jq -r ".wof_ids[]" $TILES_JSON`

for WOF_ID in $WOF_IDS ; do

	WOF_JSON="$TILES_DIR/$WOF_ID.json"

	if [ ! -f $WOF_JSON ] ; then
		API_URL="https://whosonfirst-api.mapzen.com/?api_key=$MAPZEN_API_KEY&method=whosonfirst.places.getInfo&id=$WOF_ID&extras=geom:bbox"
		curl -s -o $WOF_JSON $API_URL
	fi

	WOF_NAME=`jq -r '.place["wof:name"]' $WOF_JSON`
	BBOX=`jq -r '.place["geom:bbox"]' $WOF_JSON`

	if [ "$WOF_NAME" == "null" ] ; then
		echo "Could not find WOF ID $WOF_ID (skipping)"
		continue
	fi
	echo "Downloading $WOF_NAME ($WOF_ID)"
	echo "Bounding box: $BBOX"

	LON_MIN=`echo $BBOX | cut -d',' -f1`
	LAT_MIN=`echo $BBOX | cut -d',' -f2`
	LON_MAX=`echo $BBOX | cut -d',' -f3`
	LAT_MAX=`echo $BBOX | cut -d',' -f4`

	MIN_ZOOM=`jq -r '.min_zoom' $TILES_JSON`
	MAX_ZOOM=`jq -r '.max_zoom' $TILES_JSON`

	FORMATS=`jq -r '.formats|keys[]' $TILES_JSON`

	for FORMAT in $FORMATS ; do

		ARGS=`jq -r ".formats.$FORMAT.tilepack_args" $TILES_JSON`
		LAYER=`jq -r ".formats.$FORMAT.layer" $TILES_JSON`

		mkdir -p $TILES_DIR/tmp

		if [ ! -f "$TILES_DIR/tmp/$WOF_ID-$FORMAT.zip" ] ; then
			echo "Downloading $FORMAT tiles to tmp/$WOF_ID-$FORMAT.zip"
			tilepack $ARGS \
			         --output-formats=zipfile \
			         $LON_MIN $LAT_MIN $LON_MAX $LAT_MAX \
			         $MIN_ZOOM $MAX_ZOOM \
			         $TILES_DIR/tmp/$WOF_ID-$FORMAT
		else
			echo "Found existing tmp/$WOF_ID-$FORMAT.zip, using that"
		fi

		echo "Unzipping tmp/$WOF_ID-$FORMAT.zip to tmp/$WOF_ID-$FORMAT"
		mkdir -p $TILES_DIR/tmp/$WOF_ID-$FORMAT
		unzip -q $TILES_DIR/tmp/$WOF_ID-$FORMAT.zip -d $TILES_DIR/tmp/$WOF_ID-$FORMAT

		echo "Merging tmp/$WOF_ID-$FORMAT files into $FORMAT dir"
		mkdir -p $TILES_DIR/$FORMAT
		rsync -r $TILES_DIR/tmp/$WOF_ID-$FORMAT/$LAYER/ $TILES_DIR/$FORMAT/

	done
done

echo "Deleting temp files"
rm -rf $TILES_DIR/tmp

echo "All done!"
