<?php

date_default_timezone_set('Asia/Seoul');

// 37.5670374, 127.007694
// 40.641849, -73.959986

$default_name = 'Untitled map';
$default_lat = 40.641849;
$default_lng = -73.959986;
$default_zoom = 15;

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
} else {
	$db = new PDO('sqlite:data/maps.db');
}
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

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

function method_create_map() {
	global $db, $default_name, $default_lat, $default_lng, $default_zoom;

	$query = $db->prepare("
		INSERT INTO smol_map
		(name, latitude, longitude, zoom, created, updated)
		VALUES (?, ?, ?, ?, ?, ?)
	");
	check_query($query);

	$now = date('Y-m-d H:i:s');
	$query->execute(array(
		$default_name,
		$default_lat,
		$default_lng,
		$default_zoom,
		$now,
		$now
	));
	check_query($query);

	$id = $db->lastInsertId();
	$map = get_map($id);

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
