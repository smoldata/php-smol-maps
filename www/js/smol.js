var app = {

	setup: function() {
		document.addEventListener('deviceready', app.ready, false);
	},

	ready: function() {
		$('#app').addClass('ready');
	}

};
app.setup();
