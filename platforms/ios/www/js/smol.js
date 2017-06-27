var app = {

	httpd: null,

	setup: function() {
		document.addEventListener('deviceready', app.ready, false);
	},

	ready: function() {
		$('#app').addClass('ready');
		app.setup_httpd();
	},

	error: function(msg) {
		console.error(msg);
	},

	setup_httpd: function() {
		httpd = ( cordova && cordova.plugins && cordova.plugins.CorHttpd ) ? cordova.plugins.CorHttpd : null;
		if (httpd) {
			httpd.startServer({
				www_root: 'lib',
				port: 8080,
				localhost_only: false
			}, app.setup_map, function(error) {
				app.error('error setting up httpd: ' + error);
			});
		}
	},

	setup_map: function() {

		var map = L.map('map', {
			zoomControl: false
		});

		Tangram.leafletLayer({
			scene: 'http://localhost:8080/refill/refill-style.yaml',
			attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>'
		}).addTo(map);

		L.control.locate().addTo(map);

		map.setView([37.5670374, 127.007694], 15);
	}

};
app.setup();
