var app = {

	httpd: null,
	data: null,
	venues: [],

	marker_style: {
		fillOpacity: 0.7,
		weight: 2,
		opacity: 0.9,
		radius: 5
	},

	default_icon: 'flag',
	default_color: '#8442D5',

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
		app.setup_data(function() {
			app.setup_map();
			app.setup_menu();
		});
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

	// TODO: make this callback a promise
	setup_data: function(callback) {
		localforage.getItem('map').then(function(map) {
			if (map) {
				app.data = map;
				if (typeof callback == 'function') {
					callback();
				}
			} else {
				return app.api_call('create_map').then(function(rsp) {
					if (rsp.error) {
						console.error(rsp.error);
					} else if (rsp.map) {
						app.data = rsp.map;
						localforage.setItem('map', rsp.map);
						if (typeof callback == 'function') {
							callback();
						}
					} else {
						console.error('could not setup_data');
					}
				});
			}
		});
	},

	setup_map: function() {

		var map = L.map('map', {
			zoomControl: false
		});
		app.map = map;

		if ($(document.body).width() > 640) {
			L.control.zoom({
				position: 'bottomleft'
			}).addTo(map);
			$('.leaflet-control-zoom-in').html('<span class="fa fa-plus"></span>');
			$('.leaflet-control-zoom-out').html('<span class="fa fa-minus"></span>');
		}

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

		map.setView([app.data.latitude, app.data.longitude], app.data.zoom);
		/*map.on('moveend', function() {
			var ll = map.getCenter();
			app.update_data({
				latitude: ll.lat,
				longitude: ll.lng
			});
		});*/

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

		localforage.getItem('venues').then(app.show_venues);
	},

	setup_menu: function() {
		$('#menu .close').click(app.hide_menu);
	},

	add_venue: function() {
		var ll = app.map.getCenter();
		var venue = {
			name: null,
			lat: ll.lat,
			lng: ll.lng,
			icon: app.default_icon,
			color: app.default_color,
		};
		app.venues.push(venue);
		localforage.setItem('venues', app.venues);
		var marker = app.add_marker(venue);
		marker.openPopup();
	},

	add_marker: function(venue) {
		var ll = [venue.lat, venue.lng];
		var style = L.extend(app.marker_style, {
			color: venue.color,
			fillColor: venue.color
		});
		var marker = new L.CircleMarker(ll, style);
		marker.venue = venue;
		marker.addTo(app.map);
		var name = venue.name || (venue.lat.toFixed(6) + ', ' + venue.lng.toFixed(6));
		var html = '<span class="icon" style="background-color: ' + venue.color + ';"><span class="fa fa-' + venue.icon + '"></span></span>' + '<span class="name">' + name + '</span>';
		marker.bindPopup(html);
		return marker;
	},

	show_venues: function(venues) {
		if (! venues) {
			return;
		}
		app.venues = venues;
		for (var i = 0; i < venues.length; i++) {
			app.add_marker(venues[i]);
		}
	},

	reset_map: function() {
		app.venues = [];
		app.data = null;
		localforage.setItem('map', app.data);
		localforage.setItem('venues', app.venues);
		app.map.eachLayer(function(layer) {
			if (layer.venue) {
				app.map.removeLayer(layer);
			}
		});
	},

	update_data: function(updates) {
		console.log(updates);
		updates.id = app.data.id;
		app.api_call('update_map', updates)
			.then(function(rsp) {
				if (rsp.error) {
					console.error(rsp.error);
				} else {
					app.data.updated = rsp.map.updated;
				}
			});

		app.data = L.extend(app.data, updates);
		localforage.setItem('map', app.data);
	},

	api_call: function(method, data) {
		return $.ajax({
			method: 'POST',
			url: '/data.php?method=' + method,
			data: data
		});
	},

	show_menu: function() {
		$('#menu').addClass('active');
	},

	hide_menu: function() {
		$('#menu').removeClass('active');
	}

};
app.setup();
