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
		latitude: 37.5670374,
		longitude: 127.007694,
		zoom: 13,
		base: 'refill',
		options: {
			refill_theme: "black",
			walkabout_path: false,
			walkabout_bike: false
		},
		authors: null,
		description: null,
		current: 1,
		venues: []
	},

	venue_defaults: {

		// Updates here should be mirrored in data.php

		id: 0,
		name: null,
		address: null,
		tags: null,
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
		app.setup_screengrab();
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

		var slug_match = location.pathname.match(/\/([a-zA-Z0-9_-]+)/);
		if (slug_match) {
			// Load up the data from the server
			app.api_call('get_map', {
				slug: slug_match[1]
			}).then(function(rsp) {
				if (rsp.map) {
					app.data = app.normalize_data(rsp.map);
					localforage.setItem('map_' + app.data.id, rsp.map);
					localforage.setItem('map_id', rsp.map.id);
					callback();
				} else if (rsp.error) {
					console.error(rsp.error);
				} else {
					console.error('could not get_map ' + slug_match[1]);
				}
			});
		} else {
			// See if we have a map_id stored
			localforage.getItem('map_id').then(function(id) {
				// If yes, we are working from that map's data
				if (id && typeof id == 'number') {
					localforage.getItem('map_' + id).then(function(data) {
						if (data) {
							app.data = app.normalize_data(data);
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
		}
	},

	setup_map: function() {

		var map = L.map('map', {
			zoomControl: false
		});
		app.map = map;

		if ($(document.body).width() > 640 &&
		    ! $(document.body).hasClass('print')) {
			L.control.zoom({
				position: 'bottomleft'
			}).addTo(map);
			$('.leaflet-control-zoom-in').html('<span class="fa fa-plus"></span>');
			$('.leaflet-control-zoom-out').html('<span class="fa fa-minus"></span>');
			$('#map').addClass('has-zoom-controls');
		}

		if (! $(document.body).hasClass('print')) {
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
		}

		var scene = app.get_tangram_scene();
		console.log(scene);
		app.tangram = Tangram.leafletLayer({
			scene: scene
		}).addTo(map);

		var view = location.hash.match(/#(.+?)\/(.+?)\/(.+?)/)
		if (! view) {
			map.setView([app.data.latitude, app.data.longitude], app.data.zoom);
		} else {
			map.setView([view[2], view[3]], view[1]);
		}

		var hash = new L.Hash(map);

		if (! $(document.body).hasClass('print')) {
			slippymap.crosshairs.init(map);
			app.show_venues(app.data.venues);
		}

		$('.leaflet-pelias-search-icon').html('<span class="fa fa-bars"></span>');

		$('.leaflet-pelias-input').focus(function() {
			$('.leaflet-pelias-search-icon .fa').removeClass('fa-bars');
			$('.leaflet-pelias-search-icon .fa').addClass('fa-search');
		});

		$('.leaflet-pelias-input').blur(function() {
			$('.leaflet-pelias-search-icon .fa').removeClass('fa-search');
			$('.leaflet-pelias-search-icon .fa').addClass('fa-bars');
		});

		map.on('popupclose', function() {
			$('.leaflet-popup').removeClass('editing');
		});

		if ($(document.body).hasClass('print')) {
			app.tangram.scene.subscribe({
				view_complete: function() {
					// Not actually complete, just wait one more second
					setTimeout(function() {
						app.screengrab();
					}, 1000);
				}
			});
		}
	},

	setup_menu: function() {

		$('.leaflet-pelias-search-icon').click(function() {
			app.edit_map();
		});

		$('#menu .close').click(app.hide_menu);

		$('#map').click(function(e) {
			var venue_id = $(e.target)
				.closest('.venue')
				.data('venue-id');
			if ($(e.target).hasClass('icon') ||
			    $(e.target).closest('.icon').length > 0) {
				app.edit_venue(venue_id);
				e.preventDefault();
			} else if ($(e.target).hasClass('name') ||
			           $(e.target).closest('.name').length > 0 &&
			           ! $(e.target).closest('.leaflet-popup').hasClass('editing')) {
				app.edit_name($(e.target).closest('.venue'));
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
		$('#edit-map-set-view').click(function(e) {
			e.preventDefault();
			var ll = app.map.getCenter();
			var zoom = Math.round(app.map.getZoom());
			$('#edit-map-latitude').val(ll.lat);
			$('#edit-map-longitude').val(ll.lng);
			$('#edit-map-zoom').val(zoom);
		});
		$('#edit-map-base').change(function() {
			var base = $('#edit-map-base').val();
			if (base == 'refill') {
				$('#edit-map-preview').attr('src', '/img/preview-refill-black.jpg');
			} else if (base == 'walkabout') {
				$('#edit-map-preview').attr('src', '/img/preview-walkabout.jpg');
			}
			$('.edit-map-options').removeClass('selected');
			$('#edit-map-options-' + base).addClass('selected');
		});
		$('#edit-map-refill-theme').change(function() {
			var theme = $('#edit-map-refill-theme').val();
			$('#edit-map-preview').attr('src', '/img/preview-refill-' + theme + '.jpg');
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
		$('#edit-venue-icon').change(function() {
			var icon = $('#edit-venue-icon').val();
			$('#edit-venue-icon-display .fa')[0].className = 'fa fa-' + icon;
		});
		$('#edit-venue-color').change(function() {
			var color = $('#edit-venue-color').val();
			$('#edit-venue-icon-display').css('background-color', color);
		});
	},

	setup_screengrab: function() {
		$(document.body).keypress(function(e) {
			if ((e.key == 's' || e.key == 'S') && e.metaKey) {
				e.preventDefault();
				app.screengrab();
			}
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
			$('#edit-map-latitude').val(app.data.latitude);
			$('#edit-map-longitude').val(app.data.longitude);
			$('#edit-map-zoom').val(app.data.zoom);
			$('#edit-map-id').val(app.data.id);
			$('#edit-map-base').val(app.data.base);
			if (app.data.base == 'refill') {
				var theme = app.data.options.refill_theme;
				$('#edit-map-refill-theme').val(theme);
				$('#edit-map-preview').attr('src', '/img/preview-refill-' + theme + '.jpg');
			} else if (app.data.base == 'walkabout') {
				$('#edit-map-preview').attr('src', '/img/preview-walkabout.jpg');
				$('#edit-map-walkabout-path')[0].checked = app.data.options.walkabout_path;
				$('#edit-map-walkabout-bike')[0].checked = app.data.options.walkabout_bike;
			}
			$('.edit-map-options').removeClass('selected');
			$('#edit-map-options-' + app.data.base).addClass('selected');
			$('#edit-map-print').attr('href', '/' + app.data.slug + '?print=1' + location.hash);
			app.show_menu('edit-map');
		}
	},

	edit_map_save: function() {

		var id = parseInt($('#edit-map-id').val());
		var name = $('#edit-map-name').val();
		var latitude = parseFloat($('#edit-map-latitude').val());
		var longitude = parseFloat($('#edit-map-longitude').val());
		var zoom = parseInt($('#edit-map-zoom').val());
		var base = $('#edit-map-base').val();
		var options = app.edit_map_options();

		app.data.name = name;
		app.data.latitude = latitude;
		app.data.longitude = longitude;
		app.data.zoom = zoom;
		app.data.base = base;
		app.data.options = options;

		$('.edit-rsp').html('Saving...');
		$('.edit-rsp').removeClass('error');

		localforage.setItem('map_' + app.data.id, app.data)
			.then(function(rsp) {
				console.log('updated localforage', rsp);
			});

		var data = {
			id: id,
			name: name,
			latitude: latitude,
			longitude: longitude,
			zoom: zoom,
			base: base,
			options: JSON.stringify(options)
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

		app.map.removeLayer(app.tangram);
		app.tangram = Tangram.leafletLayer({
			scene: app.get_tangram_scene()
		}).addTo(app.map);

	},

	edit_map_options: function() {
		var options = app.data.options || {};
		var base = $('#edit-map-base').val();
		if (base == 'refill') {
			var options = {
				refill_theme: $('#edit-map-refill-theme').val()
			};
		} else if (base == 'walkabout') {
			var options = {
				walkabout_path: $('#edit-map-walkabout-path')[0].checked,
				walkabout_bike: $('#edit-map-walkabout-bike')[0].checked
			};
		}
		return options;
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
					.find('.venue')
					.attr('data-venue-id', rsp.venue.id);
				app.set_popup(marker, rsp.venue);
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

		$('#edit-venue-id').val(id);
		$('#edit-venue-name').val(venue.name);
		$('#edit-venue-address').val(venue.address);
		$('#edit-venue-tags').val(venue.tags);
		$('#edit-venue-icon').val(venue.icon);
		$('#edit-venue-icon-display').css('background-color', venue.color);
		$('#edit-venue-icon-display .fa')[0].className = 'fa fa-' + venue.icon;
		$('#edit-venue-color').val(venue.color);

		app.show_menu('edit-venue');
	},

	edit_venue_save: function() {

		var id = parseInt($('#edit-venue-id').val());
		var name = $('#edit-venue-name').val();
		var icon = $('#edit-venue-icon').val();
		var color = $('#edit-venue-color').val();
		var address = $('#edit-venue-address').val();
		var tags = $('#edit-venue-tags').val();
		var venue = null;

		for (var i = 0; i < app.data.venues.length; i++) {
			if (app.data.venues[i].id == id) {
				venue = app.data.venues[i];
				venue.name = name;
				venue.icon = icon;
				venue.color = color;
				venue.address = address;
				venue.tags = tags;
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
			icon: icon,
			color: color,
			address: address,
			tags: tags
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

	edit_name: function($venue) {
		console.log('edit_name', $venue);
		if ($venue.length == 0) {
			return;
		}
		$venue.closest('.leaflet-popup').addClass('editing');
		console.log($venue.find('.name .inner'));
		var name = $venue.find('.name .inner').html();
		$venue.find('.name').html('<input type="text" class="edit-name">');
		$venue.find('.name input').val(name);
		$venue.find('.name input')[0].select();
		console.log($venue.find('.name input'));
	},

	edit_name_save: function() {
		var name = $('.leaflet-popup input').val();
		$('.leaflet-popup .name').html('<span class="inner">' + name + '</span>');
		$('.leaflet-popup').removeClass('editing');

		var id = $('.leaflet-popup form').data('venue-id');
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
			console.error('could not save name for id ' + id);
			return;
		}

		localforage.setItem('map_' + app.data.id, app.data)
			.then(function(rsp) {
				console.log('updated localforage', rsp);
			});

		var data = {
			id: id,
			name: name,
		};
		app.api_call('update_venue', data).then(function(rsp) {
			if (rsp.error) {
				console.error(rsp.error);
				return;
			} else if (! rsp.venue) {
				console.error('Oops, something went wrong while saving. Try again?');
				return;
			} else {
				console.log('updated db', rsp);
			}
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
		var extra = '';
		extra = venue.address ? '<div class="extra">' + venue.address + '</div>' : extra;
		extra = venue.tags ? '<div class="extra">' + venue.tags + '</div>' : extra;
		var data_id = venue.id ? ' data-venue-id="' + venue.id + '"' : '';
		var html = '<form action="/data.php" class="venue"' + data_id + ' onsubmit="app.edit_name_save(); return false;">' +
				'<div class="icon" style="background-color: ' + venue.color + ';">' +
				'<span class="fa fa-' + venue.icon + '"></span></div>' +
				'<div class="name"><span class="inner">' + name + '</span>' + extra + '</div>' +
				'<div class="clear"></div>' +
				'</form>';
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
	},

	get_tangram_scene: function() {

		var labels = '';
		if (location.search.indexOf('print') !== -1) {
			labels = '-no-labels';
		}

		var base = app.data.base;
		var options = app.data.options;
		var scene = {
			global: {
				sdk_mapzen_api_key: config.mapzen_api_key
			},
			import: ['/lib/refill/refill-style' + labels + '.yaml']
		};
		if (base == 'refill') {
			scene.global = L.extend(scene.global, config.refill);
			scene.import = [
				'/lib/refill/refill-style' + labels + '.yaml',
				'/lib/refill/themes/' + options.refill_theme + '.yaml'
			];
		} else if (base == 'walkabout') {
			scene.global = L.extend(scene.global, config.walkabout);
			scene.import = [
				'/lib/walkabout/walkabout-style' + labels + '.yaml',
			];
			if (options.walkabout_path) {
				scene.global.sdk_path_overlay = true;
			}
			if (options.walkabout_bike) {
				scene.global.sdk_bike_overlay = true;
			}
		}

		if (location.search.indexOf('print') !== -1) {
			scene.import.push('/data.php?method=get_tangram_layer&id=' + app.data.id);
		}

		return scene;
	},

	normalize_data: function(data) {
		if (typeof data.options == 'undefined') {
			data.options = {};
		}
		if (typeof data.base == 'undefined') {
			data.base = 'refill';
		}
		if (typeof data.theme == 'string') {
			data.options.refill_theme = data.theme;
			delete data.theme;
		}
		if (typeof data.labels != 'undefined') {
			delete data.labels;
		}
		if (typeof data.default_color != 'undefined') {
			delete data.default_color;
		}
		return data;
	},

	screengrab: function() {
		var scene = app.tangram.scene;
		scene.screenshot().then(function(sh) {
			var prefix = app.data.name.toLowerCase().replace(/\s+/, '-');
			var fname = prefix + '-' + (new Date().getTime()) + '.png';
			saveAs(sh.blob, fname);
		});
	}

};
app.setup();
