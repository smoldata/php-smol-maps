var app = {

	httpd: null,
	data: null,

	marker_style: {
		fillOpacity: 0.7,
		weight: 2,
		opacity: 0.9,
		radius: 5
	},

	data_defaults: {

		// Updates here should be mirrored in data.php

		id: 0,
		name: 'Untitled map',
		latitude: 40.641849,
		longitude: -73.959986,
		zoom: 15,
		current: 1,
		venues: []
	},

	venue_defaults: {

		// Updates here should be mirrored in data.php

		id: 0,
		name: null,
		icon: 'flag',
		color: '#8442D5',
		current: 1
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
		app.setup_data(function() {
			console.log(app.data);
			document.title = app.data.name;
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

	setup_data: function(callback) {
		// See if we have a map_id stored
		localforage.getItem('map_id').then(function(id) {
			// If yes, we are working from that map's data
			if (id) {
				localforage.getItem('map_' + id).then(function(data) {
					if (map) {
						app.data = data;
					} else {
						console.error("could not load 'map_" + id + "' from localforage");
						app.data = app.data_defaults;
					}
					if (typeof callback == 'function') {
						callback();
					}
				});
			} else {
				// Otherwise, use the default
				app.data = app.data_defaults;
				if (typeof callback == 'function') {
					callback();
				}
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
			$('#map').addClass('has-zoom-controls');
		}

		L.control.locate({
			position: 'bottomleft'
		}).addTo(map);

		L.control.addVenue({
			position: 'bottomright',
			click: app.add_venue_handler
		}).addTo(map);

		L.control.geocoder('mapzen-byN58rS', {
			expanded: true,
			attribution: '<a href="https://mapzen.com/" target="_blank">Mapzen</a> | <a href="https://openstreetmap.org/">OSM</a>'
		}).addTo(map);

		Tangram.leafletLayer({
			scene: '/lib/refill/refill-style.yaml'
		}).addTo(map);

		map.setView([app.data.latitude, app.data.longitude], app.data.zoom);

		$('.leaflet-pelias-search-icon').html('<span class="fa fa-bars"></span>');

		$('.leaflet-pelias-input').focus(function() {
			$('.leaflet-pelias-search-icon .fa').removeClass('fa-bars');
			$('.leaflet-pelias-search-icon .fa').addClass('fa-search');
		});

		$('.leaflet-pelias-input').blur(function() {
			$('.leaflet-pelias-search-icon .fa').removeClass('fa-search');
			$('.leaflet-pelias-search-icon .fa').addClass('fa-bars');
		});

		slippymap.crosshairs.init(map);

		app.show_venues(app.data.venues);
	},

	setup_menu: function() {

		$('.leaflet-pelias-search-icon').click(function() {
			app.edit_map();
		});

		$('#menu .close').click(app.hide_menu);

		$('#map').click(function(e) {
			if ($(e.target).hasClass('icon')) {
				var venue_id = $(e.target).data('venue-id');
				app.edit_venue(venue_id);
				e.preventDefault();
			} else if ($(e.target).closest('.icon').length > 0) {
				var venue_id = $(e.target).closest('.icon').data('venue-id');
				app.edit_venue(venue_id);
				e.preventDefault();
			}
		});

		$('.btn-cancel').click(function(e) {
			e.preventDefault();
			app.hide_menu();
		});

		app.setup_edit_map_form();
		app.setup_edit_venue_form();
	},

	setup_edit_map_form: function() {
		$('#edit-map').submit(function(e) {
			e.preventDefault();
			app.edit_map_save();
		});
		$('#edit-map .edit-delete').click(function(e) {
			e.preventDefault();
			if (confirm('Are you sure you want to delete the map?')) {
				app.delete_map();
			}
		});
	},

	setup_edit_venue_form: function() {
		$('#edit-venue').submit(function(e) {
			e.preventDefault();
			app.edit_venue_save();
		});
		$('#edit-venue .edit-delete').click(function(e) {
			e.preventDefault();
			app.delete_venue();
		});
	},

	load_map: function(id) {
		app.api_call('get_map', {
			id: id
		}).then(function(rsp) {
			if (rsp.map) {

				if (rsp.map.current == 0) {
					console.error('map ' + id + ' is not current');
					return;
				}

				app.data = rsp.map;
				localforage.setItem('map_id', id);
				localforage.setItem('map_' + id, app.data);

				var ll = [app.data.latitude, app.data.longitude];
				app.map.setView(ll, app.data.zoom);

				app.map.eachLayer(function(layer) {
					if (layer.venue) {
						app.map.removeLayer(layer);
					}
				});
				app.show_venues(app.data.venues);
				document.title = app.data.name;
			} else if (rsp.error) {
				console.error(rsp.error);
			} else {
				console.error('could not load map ' + id);
			}
		});
	},

	add_map: function(callback) {
		var ll = app.map.getCenter();
		var view = {
			latitude: ll.lat,
			longitude: ll.lng,
			zoom: app.map.getZoom()
		};
		app.api_call('add_map', view).then(function(rsp) {
			if (rsp.map) {
				app.data = rsp.map;
				localforage.setItem('map_id', app.data.id);
				localforage.setItem('map_' + app.data.id, rsp.map);
				callback();
			} else if (rsp.error) {
					console.error(rsp.error);
			} else {
				console.error('could not setup_data');
			}
		});
	},

	edit_map: function() {
		if (app.data.id == 0) {
			app.add_map(app.edit_map);
		} else {
			$('#edit-map-name').val(app.data.name);
			$('#edit-map-id').val(app.data.id);
			app.show_menu('edit-map');
		}
	},

	edit_map_save: function() {

		var id = parseInt($('#edit-map-id').val());
		var name = $('#edit-map-name').val();

		app.data.name = name;
		localforage.setItem('map_' + app.data.id, app.data)
			.then(function(rsp) {
				console.log('updated localforage', rsp);
			});

		$('.edit-rsp').html('Saving...');
		$('.edit-rsp').removeClass('error');

		var data = {
			id: id,
			name: name,
		};
		app.api_call('update_map', data).then(function(rsp) {
			if (rsp.error) {
				$('.edit-rsp').html(rsp.error);
				$('.edit-rsp').addClass('error');
				return;
			} else if (! rsp.map) {
				$('.edit-rsp').html('Oops, something went wrong while saving. Try again?');
				$('.edit-rsp').addClass('error');
				return;
			} else {
				document.title = rsp.map.name;
				console.log('updated db', rsp);
			}
			$('.edit-rsp').html('');
			app.hide_menu();
		});
	},

	delete_map: function() {
		var id = app.data.id;
		app.data.current = 0;

		localforage.setItem('map_' + app.data.id, app.data)
			.then(function(rsp) {
				console.log('updated localforage', rsp);
			});

		$('.edit-rsp').html('Deleting...');
		$('.edit-rsp').removeClass('error');

		var data = {
			id: id
		};
		app.api_call('delete_map', data).then(function(rsp) {
			if (rsp.error) {
				$('.edit-rsp').html(rsp.error);
				$('.edit-rsp').addClass('error');
				return;
			}
			$('.edit-rsp').html('');
			app.hide_menu();
		});

		app.reset_map();
	},

	add_venue_handler: function() {
		if (app.data && app.data.id) {
			app.add_venue();
		} else {
			app.add_map(app.add_venue);
		}
	},

	add_venue: function() {
		var ll = app.map.getCenter();
		var venue = L.extend(app.venue_defaults, {
			map_id: app.data.id,
			latitude: ll.lat,
			longitude: ll.lng
		});

		var index = app.data.venues.length;
		app.data.venues.push(venue);
		localforage.setItem('map_' + app.data.id, app.data);

		var marker = app.add_marker(venue);
		marker.openPopup();

		app.api_call('add_venue', venue).then(function(rsp) {
			if (rsp.venue) {
				app.data.venues[index] = rsp.venue;
				localforage.setItem('map_' + app.data.id, app.data);
				marker.venue = rsp.venue;
				$(app.map.getPane('popupPane'))
					.find('.icon')
					.attr('data-venue-id', rsp.venue.id);
			} else if (rsp.error) {
				console.error(rsp.error);
			} else {
				console.error('could not add_venue');
			}
		});
	},

	edit_venue: function(id) {
		var venue = null;
		for (var i = 0; i < app.data.venues.length; i++) {
			if (app.data.venues[i].id == id) {
				venue = app.data.venues[i];
				break;
			}
		}

		if (! venue) {
			console.error('could not find venue ' + id + ' to edit');
			return;
		}

		console.log('edit_venue', venue);

		$('#edit-venue-name').val(venue.name);
		$('#edit-venue-id').val(id);

		app.show_menu('edit-venue');
	},

	edit_venue_save: function() {

		var id = parseInt($('#edit-venue-id').val());
		var name = $('#edit-venue-name').val();
		var venue = null;

		for (var i = 0; i < app.data.venues.length; i++) {
			if (app.data.venues[i].id == id) {
				venue = app.data.venues[i];
				venue.name = name;
				console.log('updated app.data', venue);
				break;
			}
		}

		if (! venue) {
			$('.edit-rsp').html('Oops, could not find venue ' + id + ' to save.');
			$('.edit-rsp').addClass('error');
			return;
		}

		app.map.eachLayer(function(layer) {
			if (layer.venue &&
			    layer.venue.id == id) {
				app.set_popup(layer, venue);
				console.log('updated layer', layer.venue);
			}
		});

		localforage.setItem('map_' + app.data.id, app.data)
			.then(function(rsp) {
				console.log('updated localforage', rsp);
			});

		$('.edit-rsp').html('Saving...');
		$('.edit-rsp').removeClass('error');

		var data = {
			id: id,
			name: name,
		};
		app.api_call('update_venue', data).then(function(rsp) {
			if (rsp.error) {
				$('.edit-rsp').html(rsp.error);
				$('.edit-rsp').addClass('error');
				return;
			} else if (! rsp.venue) {
				$('.edit-rsp').html('Oops, something went wrong while saving. Try again?');
				$('.edit-rsp').addClass('error');
				return;
			} else {
				console.log('updated db', rsp);
			}
			$('.edit-rsp').html('');
			app.hide_menu();
		});
	},

	delete_venue: function() {
		var id = parseInt($('#edit-venue-id').val());

		var new_venues = [];
		for (var i = 0; i < app.data.venues.length; i++) {
			if (app.data.venues[i].id == id) {
				continue;
			}
			new_venues.push(app.data.venues[i]);
		}
		app.data.venues = new_venues;

		localforage.setItem('map_' + app.data.id, app.data)
			.then(function(rsp) {
				console.log('updated localforage', rsp);
			});

		app.map.eachLayer(function(layer) {
			if (layer.venue &&
			    layer.venue.id == id) {
				app.map.removeLayer(layer);
			}
		});

		$('.edit-rsp').html('Deleting...');
		$('.edit-rsp').removeClass('error');

		var data = {
			id: id
		};
		app.api_call('delete_venue', data).then(function(rsp) {
			if (rsp.error) {
				$('.edit-rsp').html(rsp.error);
				$('.edit-rsp').addClass('error');
				return;
			}
			$('.edit-rsp').html('');
			app.hide_menu();
		});
	},

	add_marker: function(venue) {
		var ll = [venue.latitude, venue.longitude];
		var style = L.extend(app.marker_style, {
			color: venue.color,
			fillColor: venue.color
		});
		var marker = new L.CircleMarker(ll, style);
		marker.addTo(app.map);
		app.set_popup(marker, venue);
		return marker;
	},

	set_popup: function(marker, venue) {
		marker.venue = venue;
		var name = venue.name || (venue.latitude.toFixed(6) + ', ' + venue.longitude.toFixed(6));
		var data_id = venue.id ? ' data-venue-id="' + venue.id + '"' : '';
		var html = '<span class="icon" style="background-color: ' + venue.color + ';"' + data_id + '><span class="fa fa-' + venue.icon + '"></span></span>' + '<span class="name">' + name + '</span>';
		marker.bindPopup(html);
	},

	show_venues: function(venues) {
		if (! venues) {
			return;
		}
		app.data.venues = venues;
		for (var i = 0; i < venues.length; i++) {
			if (venues[i].current) {
				app.add_marker(venues[i]);
			}
		}
	},

	reset_map: function() {
		app.data = app.data_defaults;
		localforage.setItem('map_id', 0);
		app.map.eachLayer(function(layer) {
			if (layer.venue) {
				app.map.removeLayer(layer);
			}
		});
		document.title = app.data_defaults.name;
	},

	update_data: function(updates) {
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
		localforage.setItem('map_' + app.data.id, app.data);
	},

	api_call: function(method, data) {
		return $.ajax({
			method: 'POST',
			url: '/data.php?method=' + method,
			data: data
		});
	},

	show_menu: function(form_id) {
		$('#menu form.visible').removeClass('visible');
		$('#' + form_id).addClass('visible');
		$('#menu').addClass('active');
	},

	hide_menu: function() {
		$('#menu').removeClass('active');
	}

};
app.setup();
