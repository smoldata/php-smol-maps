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
	'base' => 'refill',
	'options' => array(
		'refill_theme' => 'black',
		'refill_detail' => 10,
		'refill_label' => 5,
		'walkabout_path' => true,
		'walkabout_bike' => false,
		'bubble_wrap_labels' => 'normal'
	)
);

if (! file_exists('data/maps.db')) {
	$db = new PDO('sqlite:data/maps.db');
	$db->query("
		CREATE table smol_map (
			id INTEGER PRIMARY KEY,
			slug VARCHAR(255),
			edit_slug VARCHAR(255),
			email VARCHAR(255),
			name VARCHAR(255),
			authors VARCHAR(255),
			description TEXT,
			latitude DOUBLE,
			longitude DOUBLE,
			zoom INTEGER,
			base VARCHAR(255),
			options TEXT,
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
			url VARCHAR(255),
			description TEXT,
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

include_once 'functions.php';

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
