LON_MIN = 126.776403417
LAT_MIN = 37.4266035554
LON_MAX = 127.205530474
LAT_MAX = 37.697175
MIN_ZOOM = 11
MAX_ZOOM = 17

all: refill walkabout

env:
	source env/bin/activate

refill: env
	mkdir www/tiles/tmp
	tilepack --type=vector \
	         --tile-format=topojson \
	         --output-formats=zipfile \
	         $(LON_MIN) $(LAT_MIN) $(LON_MAX) $(LAT_MAX) \
	         $(MIN_ZOOM) $(MAX_ZOOM) \
	         www/tiles/tmp/topojson
	unzip -q www/tiles/tmp/topojson.zip -d www/tiles/tmp
	mkdir -p www/tiles/topojson
	rsync -r www/tiles/tmp/all/ www/tiles/topojson/
	rm -rf www/tiles/tmp

walkabout: env
	mkdir www/tiles/tmp
	mkdir www/tiles/tmp/mvt
	tilepack --type=vector \
	         --tile-format=mvt \
	         --output-formats=zipfile \
	         $(LON_MIN) $(LAT_MIN) $(LON_MAX) $(LAT_MAX) \
	         $(MIN_ZOOM) $(MAX_ZOOM) \
	         www/tiles/tmp/mvt
	unzip -q www/tiles/tmp/mvt.zip -d www/tiles/tmp/mvt
	mkdir -p www/tiles/mvt
	rsync -r www/tiles/tmp/mvt/all/ www/tiles/mvt/

	mkdir www/tiles/tmp/terrain
	tilepack --type=terrain \
	         --layer=normal \
	         --tile-format=png \
	         --output-formats=zipfile \
	         $(LON_MIN) $(LAT_MIN) $(LON_MAX) $(LAT_MAX) \
	         $(MIN_ZOOM) $(MAX_ZOOM) \
	         www/tiles/tmp/terrain
	unzip -q www/tiles/tmp/terrain.zip -d www/tiles/tmp/terrain
	mkdir -p www/tiles/terrain
	rsync -r www/tiles/tmp/terrain/normal/ www/tiles/terrain/
	rm -rf www/tiles/tmp
