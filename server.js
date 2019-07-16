const Hapi = require('hapi');
const Path = require('path');

const server = Hapi.server({
	port: process.env.PORT || 3000,
	host: "0.0.0.0",
	routes: {
		files: {
			relativeTo: Path.join(__dirname, 'public')
		}
	}
});

server.route({
	method: 'GET',
	path: '/',
	handler: (request, h) => {
		return h.file('index.html');
	}
});

const init = async () => {
	await server.register(require('inert'));
	await server.register({
		plugin: require('hapi-cors'),
		options: {
			origins: ['*'],
		}
	})
	server.route({
		method: 'GET',
		path: '/static/{file*}',
		handler: (request, h) => {
			return h.file(request.params.file);
		}
	})
	await server.start();

	console.log(`Server running at: ${server.info.uri}`)
}

init();



/* -------------- Socket.io ------------------ */

const io = require('socket.io')(server.listener);
const CHANNELS = require('./src/bus/channels');

let emits = new (require('./src/IO/emits'))(io);

/**
 * Configuracion del reproductor, esta consta
 * de las funciones que el reproductor ejecutara 
 * cuando cambie su estado, en este caso los emits,
 * esto hace el que reproductor notifique de forma automatica
 * a los clientes.
 */
const reproductorConfig = {
	play: (data) => {
		emits.emit(CHANNELS.PLAY, data);
	},
	load: (data) => {
		emits.emit(CHANNELS.LOAD, data);
	},
	finish: (data) => {
		emits.emit(CHANNELS.DATASONGS, data);
	}
};

/**
 * Reproductor para el servidor
 */
const resproductor = new (require('./src/reproductores/serverReproductor'))(reproductorConfig);

io.on('connection', socket => {

	/**
	 * Envia todoas las canciones en la lista a la persona cuando se conecta.
	 */
	emits.emit(CHANNELS.DATASONGS, resproductor.getSongs(), socket);

	/**
	 * Valida si existe una cancion sonando y la envia a la persona que se conecta.
	 */
	if (resproductor.getCurrentSong() != null) {
		emits.emit(CHANNELS.LOAD, resproductor.getCurrentSong(), socket);
	}

	/**
	 * Canal por el cual se añaden canciones a al reproductor.
	 */
	socket.on(CHANNELS.ADD_SONG, (song) => {
		resproductor.setSong(song);
		/**
		 * Envia la lista de canciones  a los usuarios conectados.
		 */
		emits.emit(CHANNELS.DATASONGS, resproductor.getSongs());
	});


	/* Para resetear todo por si pasa algo */
	socket.on('clear', e => {
		songs = [];
		currentSong = null;
		io.sockets.emit('dataSongs', songs);
	});

});







