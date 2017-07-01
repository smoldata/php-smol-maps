<?php

date_default_timezone_set('Asia/Seoul');

// 37.5670374, 127.007694
// 40.641849, -73.959986

$defaults = array(

	// Updates here should be mirrored in smol.js

	'name' => 'Untitled map',
	'latitude' => 37.5670374,
	'longitude' => 127.007694,
	'zoom' => 13,
	'color' => '#8442D5',
	'icon' => 'flag',
	'theme' => 'black',
	'labels' => 'normal'
);

if (! file_exists('data/maps.db')) {
	$db = new PDO('sqlite:data/maps.db');
	$db->query("
		CREATE table smol_map (
			id INTEGER PRIMARY KEY,
			slug VARCHAR(255),
			name VARCHAR(255),
			authors VARCHAR(255),
			description TEXT,
			latitude DOUBLE,
			longitude DOUBLE,
			zoom INTEGER,
			labels VARCHAR(255),
			theme VARCHAR(255),
			default_color VARCHAR(255),
			current INTEGER DEFAULT 1,
			created DATETIME,
			updated DATETIME
		)
	");

	$db->query("
		CREATE table smol_venue (
			id INTEGER PRIMARY KEY,
			map_id INTEGER,
			name VARCHAR(255),
			address VARCHAR(255),
			tags VARCHAR(255),
			latitude DOUBLE,
			longitude DOUBLE,
			icon VARCHAR(255),
			color VARCHAR(255),
			current INTEGER DEFAULT 1,
			created DATETIME,
			updated DATETIME
		)
	");
} else {
	$db = new PDO('sqlite:data/maps.db');
}
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$db->setAttribute(PDO::ATTR_STRINGIFY_FETCHES, false); // wtf data types?

if (! empty($_REQUEST['method'])) {
	$method = "method_{$_REQUEST['method']}";
	if (function_exists($method)) {
		$rsp = $method();
		json_output($rsp);
	}
} else {
	json_output(array(
		'error' => "include a 'method' argument"
	));
}

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

	$map['id'] = intval($map['id']);
	$map['latitude'] = floatval($map['latitude']);
	$map['longitude'] = floatval($map['longitude']);
	$map['zoom'] = intval($map['zoom']);
	$map['current'] = intval($map['current']);

	return $map;
}

function get_map_by_slug($slug) {
	global $db;

	$query = $db->prepare("
		SELECT *
		FROM smol_map
		WHERE slug = ?
	");
	check_query($query);

	$query->execute(array($slug));
	$map = $query->fetch();
	if (! $map) {
		// Just generate one, whatever
		$rsp = method_add_map($slug);
		if (empty($rsp['map'])) {
			return array(
				'error' => "Could not find map '$slug'"
			);
		}
		$map = $rsp['map'];
	}

	$map['id'] = intval($map['id']);
	$map['latitude'] = floatval($map['latitude']);
	$map['longitude'] = floatval($map['longitude']);
	$map['zoom'] = intval($map['zoom']);
	$map['current'] = intval($map['current']);

	return $map;
}

function get_map_venues($map_id) {
	global $db;

	$query = $db->prepare("
		SELECT *
		FROM smol_venue
		WHERE map_id = ?
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

function get_slug() {

	global $db;

	$slug = '';
	$chars = '123456789abcdefghijklmnpqrstuvwxyz';
	$num_chars = strlen($chars);
	$length = 5;
	for ($i = 0; $i < $length; $i++) {
		$index = rand(0, $num_chars - 1);
		$slug .= substr($chars, $index, 1);
	}

	$query = $db->prepare("
		SELECT id
		FROM smol_map
		WHERE slug = ?
	");
	check_query($query);

	$query->execute(array($slug));
	$row = $query->fetch();

	if (! empty($row)) {
		return get_slug();
	}

	return $slug;
}

function method_get_maps() {
	global $db;
	$query = $db->query("
		SELECT *
		FROM smol_map
	");
	check_query($query);
	$maps = $query->fetchAll();
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
		(name, slug, latitude, longitude, zoom, theme, labels, created, updated)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	");
	check_query($query);

	$now = date('Y-m-d H:i:s');
	if (empty($slug)) {
		$slug = get_slug();
	}
	$query->execute(array(
		$defaults['name'],
		$slug,
		$defaults['latitude'],
		$defaults['longitude'],
		$defaults['zoom'],
		$defaults['theme'],
		$defaults['labels'],
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
		WHERE id = $id
	");
	check_query($query);

	$query->execute(array($id));
	check_query($query);

	return array(
		'deleted' => $id
	);

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

function json_output($out) {
	header('Content-Type: application/json');
	echo json_encode($out);
	exit;
}