( function() {

	let display = {
		canvasid: 'c',
		canvas: null,
		ctx: null,
		sprites: {},
		frame: 0,
		width: 800,
		height: 800,
		mute: false,
		sounds: [],
		animations: {}
	};

	class Animation {
		constructor( name, loop ) {
			this.name = name;
			this.loop = loop || false;
			this.sprites = [];

			this.cf = 0;
			this.cfmax = 0;
			this.cind = 0;
			this.is_done = false;
		}

		s( name, nframes ) {
			this.sprites.push( {
				max_frames: nframes,
				name: name
			} );
			if ( this.sprites.length === 1 ) {
				this.cfmax = nframes;
			}
		}

		update() {
			this.cf++;
			if ( this.cf >= this.cfmax ) {
				this.cind++;
				if ( this.cind >= this.sprites.length ) {
					this.is_done = true;
					if ( this.loop ) {
						this.cind = 0;
					} else {
						this.cind--;
					}
				}
				this.cf = 0;
				this.cfmax = this.sprites[ this.cind ].max_frames;
			}
		}

		getSprite() {
			return this.sprites[ this.cind ].name;
		}
	}

	display.setCanv = function( canvas ) {
		display.canvas = canvas;
		display.ctx = canvas.getContext( '2d' );
	};
	display.restoreCanv = function() {
		display.canvasid = display.canvasid;
		display.canvas = document.getElementById( display.canvasid );
		display.ctx = display.canvas.getContext( '2d' );
		display.width = display.canvas.width;
		display.height = display.canvas.height;
	};

	display.createSprite = function( name, drot, shapes, w, h ) {
		let spr = {
			name,
			drot,
			shapes,
			w,
			h
		};
		display.sprites[ name ] = spr;
		display.rasterize( spr );
		display.cAnim( name, () => {
			let a = new Animation( name, false );
			a.s( name, 2 );
			return a;
		} );
	};

	display.cAnim = function( name, cb ) {
		display.animations[ name ] = cb;
	};

	display.normalize = function( x, a, b, c, d ) {
		return c + ( x - a ) * ( d - c ) / ( b - a );
	};

	display.randbtwn = function( a, b ) {
		return Math.round( display.normalize( Math.random(), 0, 1, a, b ) );
	};

	display.distance = function( x1, y1, x2, y2 ) {
		let dx = x2 - x1;
		let dy = y2 - y1;
		return Math.sqrt( dx * dx + dy * dy );
	};

	display.hedToVec = function( heading, max ) {
		return {
			x: max * Math.sin( Math.PI * heading / 180 ),
			y: -max * Math.cos( Math.PI * heading / 180 )
		};
	};

	display.loadSounds = function() {
		// let loadSound = ( name ) => {
		// 	let a = document.getElementById( name );
		// 	a.load();
		// 	a.addEventListener( 'canplaythrough', () => {
		// 		let cha = [ a ];
		// 		for( let i = 0; i < 3; i++ ) {
		// 			cha.push( a.cloneNode( true ) );
		// 		}
		// 		display.sounds[ name ] = {
		// 			cc: 0,
		// 			cha
		// 		};
		// 	} );
		// };
		let loadSound = ( name, args ) => {
			let url = window.jsfxr( args );
			let cha = [];
			for ( let i = 0; i < 4; i++ ) {
				let s = new Audio();
				s.src = url;
				cha.push( s );
			}
			display.sounds[ name ] = {
				cc: 0,
				cha
			};
		};

		loadSound( 'sand', [ 3, 0.13, 0.26, 0.95, 0.35, 0.37, , 0.5, , 0.19, 0.37, 0.8799, 0.35, , , , , , 1, -0.92, 0.12, 0.1614, , 0.25 ] );
		loadSound( 'bomb', [ 0, 0.13, 0.26, 0.53, 0.35, 0.04, , 0.5, , 0.19, 0.37, 0.1799, 0.35, , , 0.56, -0.86, 0.76, 1, 0.56, 0.68, 0.78, -0.4599, 0.25 ] );
		loadSound( 'coin', [ 0, , 0.0917, 0.37, 0.32, 0.54, , , , 0.23, 0.02, 0.4813, 0.65, , , , 0.8, , 1, , 0.11, , , 0.25 ] );
		loadSound( 'expa', [ 3, , 0.1083, 0.3869, 0.3314, 0.1406, , -0.2676, , , , , , , , , 0.5116, -0.2477, 1, , , , , 0.25 ] );
		loadSound( 'expg', [ 3,,0.3646,0.7897,0.2321,0.1281,,-0.3439,,,,,,,,,0.2502,-0.0041,1,,,,,0.25 ] );
		loadSound( 'bombg', [ 3, , 0.01, 0.6031, 0.4332, 0.027, , 0.2071, , , , , , , , , , , 1, , , , , 0.25 ] );
		loadSound( 'bullet', [ 1, 0.0054, 0.2302, , 0.2346, 0.9064, 0.1659, -0.6154, 0.0044, 0.0708, 0.0179, 0.0085, 0.066, 0.5, -0.5604, 0.0104, 0.0832, -0.0182, 0.9625, 0.0138, 0.1126, 0.088, 0.0132, 0.25 ] );
		loadSound( 'lz', [ 2, 0.0054, 0.2302, , 0.2346, 0.76, , -0.6154, 0.0044, 0.0708, 0.0179, 0.0085, 0.066, 0.5, -0.5604, 0.0104, 0.0832, -0.0182, 0.9625, 0.0138, 0.1126, 0.088, 0.0132, 0.15 ] );
		loadSound( 'upl', [ 0, , 0.26, , 0.8, 0.45, , 0.305, , , , , , 0.5555, , 0.6, , , 1, , , , , 0.25 ] );
		loadSound( 'hp', [ 0, , 0.2084, , 0.2832, 0.5027, , -0.48, 0.6599, , , , , 0.316, , , , , 0.5663, , , , , 0.5 ] );
		loadSound( 'blip', [ 1, , 0.1086, , 0.1316, 0.2639, , , , , , , , , , , , , 1, , , 0.1, , 0.25 ] );
		loadSound( 'har', [ 3, , 0.1128, 0.95, 0.51, 0.4741, , -0.287, , , , , , , , 0.3824, 0.5549, -0.2718, 1, , , , , 0.25 ] );
		loadSound( 'uplf', [ 1, , 0.57, 0.1, 0.0482, 0.16, , , 0.02, 0.11, 0.32, , , , , , , , 1, , , 0.1, , 0.25 ] );
		loadSound( 'lvlf', [ 0, , 0.52, 0.25, 1, 0.27, , , , 0.47, 0.12, 0.1999, 0.14, 0.3, 0.6399, 0.552, , , 1, , 0.13, , , 0.25 ] );
		loadSound( 'lvlc', [ 0, 0.04, 0.23, 0.19, 0.59, 0.24, , , , , , , , 0.5161, , , , , 1, , , 0.1, , 0.25 ] );
		loadSound( 'hit', [ 3, , 0.0887, , 0.1681, 0.6516, , -0.4825, , , , , , , , , , , 1, , , 0.129, , 0.25 ] );
		loadSound( 'sp', [ 1, , 0.34, , 0.67, 0.16, , 0.4536, , , , -0.24, , , , 0.4182, , , 0.39, , , , , 0.25 ] );
		loadSound( 'lvls', [ 3, 0.28, 0.31, 0.08, 0.7, 0.0081, , 0.4503, 0.0324, 0.8, 0.3, 0.62, 0.25, 0.3357, 0.1636, -0.9992, 0.06, 0.24, 0.9625, , -0.7401, , 0.0036, 0.30 ] );
	};

	display.playSound = function( name ) {
		if ( display.mute ) {
			return;
		}
		let s = display.sounds[ name ];
		let ind = ( s && s.cc++ % s.cha.length );
		s.cha[ ind ].play();
	};

	display.setError = function() {
		//console.error( txt );
		display.error = true;
	};

	display.setLoop = function( cb ) {
		let then = 0;
		let _loop = ( now ) => {
			now *= 0.001;
			display.delta_t = now - then;
			then = now;
			display.frame++;
			if ( display.frame > 720 ) {
				display.frame = 0;
			}
			cb();
			if ( !display.error ) {
				window.requestAnimationFrame( _loop );
			}
		};
		window.requestAnimationFrame( _loop );
	};

	display.getCtx = function() {
		return display.ctx;
	};

	display.clearScreen = function() {
		let ctx = display.getCtx();
		ctx.fillStyle = 'black';
		ctx.fillRect( 0, 0, ctx.canvas.width, ctx.canvas.height );
	};

	display.rect = function( { x = 0, y = 0, w, h, color, c, rot = 0, outline = false } ) {
		let ctx = display.getCtx();
		ctx.rotate( rot * Math.PI / 180 );
		if ( outline ) {
			ctx.fillStyle = '#111';
			ctx.fillRect( x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2 );
		}
		ctx.fillStyle = color || c;
		ctx.fillRect( x - w / 2, y - h / 2, w, h );
	};

	display.circle = function( { x = 0, y = 0, r = 0, color, c, o } ) {
		let ctx = display.getCtx();
		ctx.lineWidth = 3;
		ctx.fillStyle = color || c;
		ctx.beginPath();
		ctx.arc( x, y, r, 0, 2 * Math.PI );
		if( o ) {
			ctx.strokeStyle = color || c;
			ctx.stroke();
		} else {
			ctx.fill();
		}
	};

	display.rotate = function( rot, { x = 0, y = 0, w = 0, h = 0 } ) {
		let ctx = display.getCtx();
		if ( rot !== undefined ) {
			x -= w / 2;
			y -= h / 2;
			ctx.translate( x, y );
			ctx.translate( w, h );
			ctx.rotate( rot * Math.PI / 180 );
			x = -w / 2;
			y = -h / 2;
		}
		return { x: x, y: y };
	};

	display.line = function( { x, y, x2, y2, color, w = 3 } ) {
		let ctx = display.getCtx();
		ctx.beginPath();
		ctx.lineWidth = w;
		ctx.strokeStyle = color;
		ctx.moveTo( x, y );
		ctx.lineTo( x2, y2 );
		ctx.stroke();
	};

	display.getAnim = function( k ) {
		if ( display.animations[ k ] ) {
			const a = display.animations[ k ]();
			a.name = k;
			return a;
		} else {
			//console.error( 'No animation named: ', k );
			display.setError();
			return null;
		}
	};

	display.rasterize = function( spr ) {
		let canvas = document.createElement( 'canvas' );
		let ctx = canvas.getContext( '2d' );
		canvas.width = spr.w || 1;
		canvas.height = spr.h || 1;
		display.setCanv( canvas );
		ctx.clearRect( 0, 0, spr.w, spr.h );
		ctx.save();
		ctx.translate( spr.w / 2, spr.h / 2 );
		spr.shapes.forEach( ( shape ) => {
			if ( shape.c || shape.color ) {
				ctx.save();
				shape.outline = shape.outline === undefined ? true : shape.outline;
				display[ shape.type || 'rect' ].call( display, shape );
				ctx.restore();
			}
		} );
		spr.canvas = canvas;
		ctx.restore();
		display.restoreCanv();
	};

	display.drawSprite = function( name, x, y, scale, rot ) {
		let spr = this.sprites[ name ];
		if ( !spr ) {
			display.setError( 'no sprite exists named "' + name + '"' );
			return;
		}
		let obj = { x: x - spr.w / 2, y: y - spr.h / 2 };
		spr.x = obj.x;
		spr.y = obj.y;
		let ctx = display.getCtx();
		ctx.save();
		if ( rot === undefined ) {
			if ( spr.drot ) {
				obj = display.rotate( ( display.frame * spr.drot ) % 360, spr );
			}
		} else {
			obj = display.rotate( rot, spr );
		}
		ctx.drawImage( spr.canvas, obj.x, obj.y );
		ctx.restore();
	};

	display.drawText = function( text, x, y, params ) {
		let ctx = display.getCtx();
		let { font, size, color, c } = params || {};
		ctx.font = ( size || 16 ) + 'px ' + ( font || 'monospace' );
		ctx.fillStyle = color || c || 'white';
		ctx.fillText( text, x, y );
	};

	display.drawAnim = function( anim, x, y, scale, rot ) {
		let sprite_name = anim.getSprite();
		display.drawSprite( sprite_name, x, y, scale, rot );
		anim.update();
	};

	display.drawAnimation = display.drawAnim;

	display.init = function( canvasid, cb ) {
		if ( canvasid ) {
			display.canvasid = canvasid;
			display.restoreCanv();
		}
		if ( display.loaded ) {
			cb();
			return;
		}
		if ( display.loading ) {
			//console.log( 'Display is already loading...' );
			return;
		}

		display.loadSounds();

		window.app.sprites.createSprites();

		let player_fs = 5;
		display.cAnim( 'pl_default', () => {
			let a = new Animation( '', false );
			a.s( 'p2', player_fs );
			return a;
		} );
		display.cAnim( 'pl_from_left', () => {
			let a = new Animation( '', false );
			a.s( 'p1', player_fs );
			a.s( 'p2', player_fs );
			return a;
		} );
		display.cAnim( 'pl_from_right', () => {
			let a = new Animation( '', false );
			a.s( 'p3', player_fs );
			a.s( 'p2', player_fs );
			return a;
		} );
		display.cAnim( 'pl_left', () => {
			let a = new Animation( '', false );
			a.s( 'p1', player_fs );
			a.s( 'p0', player_fs );
			return a;
		} );
		display.cAnim( 'pl_right', () => {
			let a = new Animation( '', false );
			a.s( 'p3', player_fs );
			a.s( 'p4', player_fs );
			return a;
		} );
		let expl_fs = 6;
		display.cAnim( 'expl_air', () => {
			let a = new Animation( '', false );
			for ( let i = 0; i <= 4; i++ ) {
				a.s( `expl${i}`, expl_fs );
			}
			return a;
		} );
		display.cAnim( 'expl_bomb', () => {
			let a = new Animation( '', false );
			for ( let i = 5; i <= 9; i++ ) {
				a.s( `expl${i}`, expl_fs );
			}
			return a;
		} );
		display.cAnim( 'expl_lazer', () => {
			let a = new Animation( '', false );
			for ( let i = 0; i <= 2; i++ ) {
				a.s( `expl1${i}`, expl_fs );
			}
			return a;
		} );
		display.cAnim( 'cache', () => {
			let a = new Animation( '', true );
			for ( let i = 0; i <= 2; i++ ) {
				a.s( `cache${i}`, 4 );
			}
			a.s( 'cache1', 4 );
			return a;
		} );
		display.cAnim( 'flash', () => {
			let a = new Animation( '', false );
			a.s( 'flash1', 5 );
			return a;
		} );
		display.cAnim( 'pwrcoin', () => {
			let a = new Animation( '', true );
			for ( let i = 0; i <= 2; i++ ) {
				a.s( `pc${i}`, 4 );
			}
			a.s( 'pc1', 8 );
			return a;
		} );
		display.cAnim( 'plug', () => {
			let a = new Animation( '', true );
			for ( let i = 0; i <= 2; i++ ) {
				a.s( `plug${i}`, 4 );
			}
			a.s( 'plug1', 8 );
			return a;
		} );
		display.cAnim( 'plugdead', () => {
			let a = new Animation( '', false );
			a.s( 'plug4', 8 );
			return a;
		} );

		cb();
	};

	window.app.display = display;

} )();
