<?php

function get_map($id) {
	global $db;

	$query = $db->prepare("
		SELECT *
		FROM smol_map
		WHERE id = ?
	");
	check_query($query);

	$query->execute(array($id));
	$map = $query->fetch();
	if (! $map) {
		json_output(array(
			'error' => "map $id not found"
		));
	}

	$map = normalize_map_values($map);
	return $map;
}

function get_map_by_slug($slug) {
	global $db, $defaults;

	$query = $db->prepare("
		SELECT *
		FROM smol_map
		WHERE slug = ?
	");
	check_query($query);

	$query->execute(array($slug));
	$map = $query->fetch();
	if (! $map) {
		return array(
			'error' => "Could not find map '$slug'"
		);
	}

	$map = normalize_map_values($map);
	return $map;
}

function get_map_venues($map_id) {
	global $db;

	$query = $db->prepare("
		SELECT *
		FROM smol_venue
		WHERE map_id = ?
		  AND current = 1
	");
	check_query($query);

	$query->execute(array($map_id));
	$venues = $query->fetchAll();

	foreach ($venues as $id => $venue) {
		$venue['id'] = intval($venue['id']);
		$venue['map_id'] = intval($venue['map_id']);
		$venue['latitude'] = floatval($venue['latitude']);
		$venue['longitude'] = floatval($venue['longitude']);
		$venue['current'] = intval($venue['current']);
		$venues[$id] = $venue;
	}

	return $venues;
}

function get_venue($id) {
	global $db;

	$query = $db->prepare("
		SELECT *
		FROM smol_venue
		WHERE id = ?
	");
	check_query($query);

	$query->execute(array($id));
	$venue = $query->fetch();
	if (! $venue) {
		json_output(array(
			'error' => "venue $id not found"
		));
	}

	$venue['id'] = intval($venue['id']);
	$venue['map_id'] = intval($venue['map_id']);
	$venue['latitude'] = floatval($venue['latitude']);
	$venue['longitude'] = floatval($venue['longitude']);
	$venue['current'] = intval($venue['current']);

	return $venue;
}

function get_slug($length = 4, $col = 'slug') {

	global $db;

	$slug = '';
	$chars = '23456789abcdefghijkmnpqrstuvwxyz'; // All but 1, l, 0, and o
	$num_chars = strlen($chars);

	for ($i = 0; $i < $length; $i++) {
		$index = rand(0, $num_chars - 1);
		$slug .= substr($chars, $index, 1);
	}

	$query = $db->prepare("
		SELECT id
		FROM smol_map
		WHERE $col = ?
	");
	check_query($query);

	$query->execute(array($slug));
	$row = $query->fetch();

	if (! empty($row)) {
		return get_slug($length, $col);
	}

	return $slug;
}

function method_get_maps() {
	global $db;
	$query = $db->query("
		SELECT *
		FROM smol_map
		WHERE public = 1
		  AND current = 1
	");
	check_query($query);
	$maps = $query->fetchAll();
	foreach ($maps as $index => $map) {
		$maps[$index] = normalize_map_values($map);
	}
	return array(
		'maps' => $maps
	);
}

function method_get_map() {

	if (empty($_POST['slug'])) {
		json_output(array(
			'error' => "include a 'slug' arg"
		));
	}
	$slug = $_POST['slug'];

	$map = get_map_by_slug($slug);
	$map['venues'] = get_map_venues($map['id']);

	return array(
		'map' => $map
	);
}

function method_add_map($slug = null) {
	global $db, $defaults;

	$query = $db->prepare("
		INSERT INTO smol_map
		(name, slug, edit_slug, latitude, longitude, zoom, base, options, created, updated)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	");
	check_query($query);

	$now = date('Y-m-d H:i:s');
	if (empty($slug)) {
		$slug = get_slug(4, 'slug');
	}
	$edit_slug = get_slug(12, 'edit_slug');
	$query->execute(array(
		$defaults['name'],
		$slug,
		$edit_slug,
		$defaults['latitude'],
		$defaults['longitude'],
		$defaults['zoom'],
		$defaults['base'],
		json_encode($defaults['options']),
		$now,
		$now
	));
	$error = $db->errorInfo();
	check_query($query);

	$id = $db->lastInsertId();
	$map = get_map($id);
	$map['venues'] = array();

	return array(
		'map' => $map
	);
}

function method_update_map() {
	global $db;

	if (empty($_POST['id'])) {
		json_output(array(
			'error' => "include an 'id' arg"
		));
	}
	$id = intval($_POST['id']);
	$_POST['updated'] = date('Y-m-d H:i:s');
	unset($_POST['method']);

	if ($_POST['slug']) {
		$existing = get_map_by_slug($_POST['slug']);
		if ($existing['id'] && $id != $existing['id']) {
			json_output(array(
				'error' => "that URL has already been taken"
			));
		}

		if (! preg_match('/^[a-z0-9-]+$/i', $_POST['slug'])) {
			json_output(array(
				'error' => "the URL can only use only letters, numbers, and hyphens"
			));
		}

		$_POST['slug'] = strtolower($_POST['slug']);
	}

	$assign = array();
	$values = array();
	foreach ($_POST as $key => $value) {
		$assign[] = $key . " = ?";
		$values[] = $value;
	}
	$assign = implode(', ', $assign);

	$query = $db->prepare("
		UPDATE smol_map
		SET $assign
		WHERE id = $id
	");
	check_query($query);

	$query->execute($values);
	$map = get_map($id);

	return array(
		'map' => $map
	);
}

function method_add_venue() {

	global $db, $defaults;

	$required = array('map_id', 'latitude', 'longitude', 'color', 'icon');

	foreach ($required as $req) {
		if (empty($_POST[$req])) {
			json_output(array(
				'error' => "include an '$req' arg"
			));
		}
	}

	$query = $db->prepare("
		INSERT INTO smol_venue
		(map_id, name, latitude, longitude, color, icon, created, updated)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	");
	check_query($query);

	if (! empty($_POST['name'])) {
		$name = $_POST['name'];
	} else {
		$name = null;
	}

	if (! empty($_POST['color'])) {
		$color = $_POST['color'];
	} else {
		$color = $defaults['color'];
	}

	if (! empty($_POST['icon'])) {
		$icon = $_POST['icon'];
	} else {
		$icon = $defaults['icon'];
	}

	$now = date('Y-m-d H:i:s');

	$query->execute(array(
		$_POST['map_id'],
		$name,
		$_POST['latitude'],
		$_POST['longitude'],
		$color,
		$icon,
		$now,
		$now
	));
	check_query($query);

	$id = $db->lastInsertId();
	$venue = get_venue($id);

	return array(
		'venue' => $venue
	);
}

function method_update_venue() {

	global $db;

	if (! isset($_POST['id'])) {
		json_output(array(
			'error' => "include an 'id' arg"
		));
	}

	$id = intval($_POST['id']);
	$_POST['updated'] = date('Y-m-d H:i:s');
	unset($_POST['method']);

	$assign = array();
	$values = array();
	foreach ($_POST as $key => $value) {
		$assign[] = $key . " = ?";
		$values[] = $value;
	}
	$assign = implode(', ', $assign);

	$query = $db->prepare("
		UPDATE smol_venue
		SET $assign
		WHERE id = $id
	");
	check_query($query);

	$query->execute($values);
	check_query($query);

	$venue = get_venue($id);

	return array(
		'venue' => $venue
	);

}

function method_delete_map() {

	global $db;

	if (! isset($_POST['id'])) {
		json_output(array(
			'error' => "include an 'id' arg"
		));
	}

	$id = intval($_POST['id']);
	$query = $db->prepare("
		UPDATE smol_map
		SET current = 0
		WHERE id = ?
	");
	check_query($query);

	$query->execute(array($id));
	check_query($query);

	return array(
		'deleted' => $id
	);

}

function method_delete_venue() {

	global $db;

	if (! isset($_POST['id'])) {
		json_output(array(
			'error' => "include an 'id' arg"
		));
	}

	$id = intval($_POST['id']);
	$query = $db->prepare("
		UPDATE smol_venue
		SET current = 0
		WHERE id = ?
	");
	check_query($query);

	$query->execute(array($id));
	check_query($query);

	return array(
		'deleted' => $id
	);

}

function method_get_tangram_layer() {

	global $db;

	if (! isset($_GET['id'])) {
		json_output(array(
			'error' => "include an 'id' arg"
		));
	}
	$id = $_GET['id'];

	header('Content-Type: text/plain');
	$venues = get_map_venues($id);

	echo "styles:\n";
	echo "    _points:\n";
	echo "        base: points\n";
	echo "        blend: overlay\n";
	echo "        blend_order: 3\n";

	echo "sources:\n";

	foreach ($venues as $index => $venue) {
		$source = "_venue_source_$index";
		echo "    $source:\n";
		echo "        type: GeoJSON\n";
		echo "        url: /data.php?method=get_venue_geojson&id={$venue['id']}\n";
	}

	echo "layers:\n";
	foreach ($venues as $index => $venue) {
		$layer = "_venue_layer_$index";
		$source = "_venue_source_$index";
		$rgb = hex2rgb($venue['color']);
		$rgb = implode(', ', $rgb);
		echo "    $layer:\n";
		echo "        data: { source: $source }\n";
		echo "        _dots:\n";
		echo "            draw:\n";
		echo "                _points:\n";
		echo "                    color: rgba({$rgb}, 0.7)\n";
		echo "                    size: 12px\n";
		echo "                    outline:\n";
		echo "                        width: 2px\n";
		echo "                        color: \"{$venue['color']}\"\n";
		echo "                    text:\n";
		echo "                        text_source: name\n";
		echo "                        font:\n";
		echo "                            family: global.text_font_family\n";
		echo "                            weight: bold\n";
		echo "                            fill: black\n";
		echo "                            size: 10pt\n";
		echo "                            stroke:\n";
		echo "                                width: 5px\n";
		echo "                                color: white\n";
	}
	exit;
}

function method_get_venue_geojson() {
	if (! isset($_GET['id'])) {
		json_output(array(
			'error' => "include an 'id' arg"
		));
	}
	$id = $_GET['id'];

	$venue = get_venue($id);

	$feature = array(
		'type' => 'Feature',
		'properties' => array(
			'name' => $venue['name']
		),
		'geometry' => array(
			'type' => 'Point',
			'coordinates' => array(
				$venue['longitude'],
				$venue['latitude']
			)
		)
	);
	$feature_collection = array(
		'type' => 'FeatureCollection',
		'features' => array($feature)
	);

	header('Content-Type: application/json');
	echo json_encode($feature_collection);
	exit;
}

function check_query($query) {
	global $db;
	if (! $query) {
		$error = $db->errorInfo();
		json_output(array(
			'error' => $error[2]
		));
	}
}

function hex2rgb($color){
	$color = str_replace('#', '', $color);
	$rgb = array();
	for ($i = 0; $i < 3; $i++) {
		$rgb[$i] = hexdec(substr($color,(2 * $i), 2));
	}
	return $rgb;
}

function normalize_map_values($map) {

	global $defaults;

	$map['id'] = intval($map['id']);
	$map['latitude'] = floatval($map['latitude']);
	$map['longitude'] = floatval($map['longitude']);
	$map['zoom'] = intval($map['zoom']);
	$map['current'] = intval($map['current']);

	unset($map['edit_slug']);
	unset($map['email']);

	if (empty($map['options'])) {
		$map['options'] = $defaults['options'];
	} else if (! is_array($map['options'])) {
		$map['options'] = json_decode($map['options'], 'as hash');
	}

	return $map;
}

function json_output($out) {
	header('Content-Type: application/json');
	echo json_encode($out);
	exit;
}
