var app = {

	httpd: null,

	default_style: {
		color: '#136AEC',
		fillColor: '#2A93EE',
		fillOpacity: 0.7,
		weight: 2,
		opacity: 0.9,
		radius: 5
	},

	init: function() {
		if (typeof cordova == 'object') {
			document.addEventListener('deviceready', app.ready, false);
		} else {
			app.ready();
			app.setup();
		}
	},

	ready: function() {
		$('#app').addClass('ready');
		app.start_httpd();
	},

	setup: function() {
		app.setup_map();
		app.setup_menu();
	},

	error: function(msg) {
		console.error(msg);
	},

	start_httpd: function() {
		httpd = ( typeof cordova == 'object' && cordova.plugins && cordova.plugins.CorHttpd ) ? cordova.plugins.CorHttpd : null;
		if (httpd) {
			httpd.startServer({
				www_root: '.',
				port: 8080,
				localhost_only: false
			}, app.setup, app.error);
		}
	},

	setup_map: function() {

		var map = L.map('map', {
			zoomControl: false
		});
		app.map = map;

		L.control.locate({
			position: 'bottomleft'
		}).addTo(map);

		L.control.addVenue({
			position: 'bottomright',
			click: app.add_venue
		}).addTo(map);

		L.control.geocoder('mapzen-byN58rS', {
			expanded: true,
			attribution: '<a href="https://mapzen.com/" target="_blank">Mapzen</a> | <a href="https://openstreetmap.org/">OSM</a>'
		}).addTo(map);

		Tangram.leafletLayer({
			scene: '/lib/refill/refill-style.yaml'
		}).addTo(map);

		// Seoul
		//map.setView([37.5670374, 127.007694], 15);

		// Flatbush
		map.setView([40.641849, -73.959986], 15);

		$('.leaflet-pelias-search-icon').html('<span class="fa fa-bars"></span>');

		$('.leaflet-pelias-search-icon').click(function() {
			app.show_menu();
		});

		$('.leaflet-pelias-control').addClass('show-menu-icon');

		$('.leaflet-pelias-input').focus(function() {
			$('.leaflet-pelias-search-icon .fa').removeClass('fa-bars');
			$('.leaflet-pelias-search-icon .fa').addClass('fa-search');
		});

		$('.leaflet-pelias-input').blur(function() {
			$('.leaflet-pelias-search-icon .fa').removeClass('fa-search');
			$('.leaflet-pelias-search-icon .fa').addClass('fa-bars');
		});

		slippymap.crosshairs.init(map);
	},

	setup_menu: function() {
		$('#menu .close').click(app.hide_menu);
	},

	add_venue: function() {
		var ll = app.map.getCenter();
		var marker = new L.CircleMarker(ll, app.default_style).addTo(app.map);
		var html = '<span class="emoji">📍</span> ' + ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6);
		marker.bindPopup(html).openPopup();
	},

	show_menu: function() {
		$('#menu').addClass('active');
	},

	hide_menu: function() {
		$('#menu').removeClass('active');
	},



};
app.setup();
