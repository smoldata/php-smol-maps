<?php

$colors = array(
	'black',
	'blue',
	'blue-gray',
	'brown-orange',
	'gray',
	'gray-gold',
	'high-contrast',
	'inverted',
	'pink',
	'pink-yellow',
	'purple-green',
	'sepia'
);

foreach ($colors as $color) {
	echo "$color\n";
	exec("curl -s -o $color-normal.zip https://mapzen.com/carto/refill-style/7.2/themes/$color.zip");
	exec("curl -s -o $color-more-labels.zip https://mapzen.com/carto/refill-style-more-labels/7.2/themes/$color.zip");
	exec("curl -s -o $color-no-labels.zip https://mapzen.com/carto/refill-style-no-labels/7.2/themes/$color.zip");
}
