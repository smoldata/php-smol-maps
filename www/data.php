<?php

date_default_timezone_set('Asia/Seoul');

// 37.5670374, 127.007694
// 40.641849, -73.959986

$defaults = array(

	// Updates here should be mirrored in smol.js

	'name' => 'Untitled map',
	'latitude' => 40.641849,
	'longitude' => -73.959986,
	'zoom' => 15,
	'color' => '#8442D5',
	'icon' => 'flag'
);

if (! file_exists('data/maps.db')) {
	$db = new PDO('sqlite:data/maps.db');
	$db->query("
		CREATE table smol_map (
			id INTEGER PRIMARY KEY,
			name VARCHAR(255),
			latitude DOUBLE,
			longitude DOUBLE,
			zoom INTEGER,
			created DATETIME,
			updated DATETIME
		)
	");

	$db->query("
		CREATE table smol_venue (
			id INTEGER PRIMARY KEY,
			map_id INTEGER,
			name VARCHAR(255),
			latitude DOUBLE,
			longitude DOUBLE,
			icon VARCHAR(255),
			color VARCHAR(255),
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
		$method();
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

	return $venue;
}

function method_get_maps() {
	global $db;
	$query = $db->query("
		SELECT *
		FROM smol_map
	");
	check_query($query);
	$maps = $query->fetchAll();
	json_output(array(
		'maps' => $maps
	));
}

function method_get_map() {

	if (empty($_POST['id'])) {
		json_output(array(
			'error' => "include an 'id' arg"
		));
	}
	$id = $_POST['id'];

	$map = get_map($id);
	$map['venues'] = get_map_venues($id);

	json_output(array(
		'map' => $map
	));
}

function method_add_map() {
	global $db, $defaults;

	$query = $db->prepare("
		INSERT INTO smol_map
		(name, latitude, longitude, zoom, created, updated)
		VALUES (?, ?, ?, ?, ?, ?)
	");
	check_query($query);

	$now = date('Y-m-d H:i:s');
	$query->execute(array(
		$defaults['name'],
		$defaults['latitude'],
		$defaults['longitude'],
		$defaults['zoom'],
		$now,
		$now
	));
	check_query($query);

	$id = $db->lastInsertId();
	$map = get_map($id);
	$map['venues'] = array();

	json_output(array(
		'map' => $map
	));
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

	json_output(array(
		'map' => $map
	));
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

	json_output(array(
		'venue' => $venue
	));
}

function method_update_venue() {

	global $db;

	$required = array('id');

	foreach ($required as $req) {
		if (! isset($_POST[$req])) {
			json_output(array(
				'error' => "include an '$req' arg"
			));
		}
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

	json_output(array(
		'venue' => $venue
	));

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
