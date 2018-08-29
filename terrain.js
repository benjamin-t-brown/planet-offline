( function() {

let display = window.app.display;
let terrain = window.app.terrain = {};

let tile_width = terrain.tile_width = 25;
let tile_height = terrain.tile_height = 32;
let tx_offset = -6;
let ty_offset = 7;
let text_params = {
	size: 24
};
let current_canv = null;

let norm = function() {
	return Math.round( display.normalize.apply( null, arguments ) );
};

let seed = 123456;
function rand() {
	let x = Math.sin( seed++ ) * 10000;
	return x - Math.floor( x );
}
function oneOf( arr ) {
	return arr[ Math.floor( rand() * arr.length ) ];
}
function to1d( x, y, w ) {
	return y * w + x;
}
function inBounds( x, y ) {
	if( y >= 0 && x >= 0 && x < 32 ) {
		return true;
	} else {
		return false;
	}
}
function adjTo( x, y, map, type ) {
	let i = to1d( x, y, 32 );
	let t = map[ i ];
	if( t.type === type || x < 1 || y < 1 || x > 31 ) {
		return false;
	}
	let t1 = map[ i + 1 ];
	let t2 = map[ i - 1 ];
	var t3 = map[ i - 32 ];
	var t4 = map[ i + 32 ];
	if( t1 && t1.type === type ) {
		return true;
	} else if( t2 && t2.type === type ) {
		return true;
	} else if( t3 && t3.type === type ) {
		return true;
	} else if( t4 && t4.type === type ) {
		return true;
	} else {
		return false;
	}
}

let tiles = {
	none: {
		ch: ' ',
		fg: [ '#FFF' ],
		bg: [ '#000' ]
	},
	tr: {
		ch: ' ',
		fg: [ '#373', '#363' ],
		bg: [ '#031', '#040', '#121' ]
	},
	gr: {
		ch: ' ',
		fg: [ '#3A3', '#5D5' ],
		bg: [ '#464', '#252', '#151' ]
	},
	dirt: {
		ch: '.,,"`\'',
		fg: [ '#3DD', '#394' ],
		bg: [ '#584', '#871', '#662' ]
	},
	mtn: {
		ch: '/\\^#',
		fg: [ '#773' ],
		bg: [ '#330' ]
	},
	mtn2: {
		ch: '  ^',
		fg: [ '#98A' ],
		bg: [ '#546', '#557' ]
	},
	wtr: {
		ch: '~ ',
		fg: [ '#3FF', '#4FF' ],
		bg: [ '#005', '#004' ]
	},
	shore: {
		ch:  '  _.',
		fg: [ '#EB8' ],
		bg: [ '#765', '#764', '#775' ]
	},
	rock: {
		ch: '~.',
		fg: [ '#F22', '#F33', '#F44' ],
		bg: [ '#111', '#112', '#122', '#222' ]
	},
	lava: {
		ch: '~*  ',
		fg: [ '#F82', '#FA3' ],
		bg: [ '#611', '#511' ]
	},
	lshore: {
		ch: '  _.',
		fg: [ '#CB8' ],
		bg: [ '#755', '#855' ]
	},
	w: {
		ch: '#@',
		fg: [ '#111', '#222' ],
		bg: [ '#622', '#722', '#822' ]
	}
};

function createTile( type, x, y ) {
	let t = tiles[ type ];
	return {
		type,
		x,
		y,
		ch: oneOf( t.ch ),
		fg: oneOf( t.fg ),
		bg: oneOf( t.bg ),
		ref: t
	};
}

function clump( ix, iy, types, map ) {
	let r = norm( rand(), 0, 1, 8, 15 );
	for( let y = iy; y < r + iy; y++ ) {
		for( let x = ix; x < r + ix; x++ ) {
			if( !inBounds( x, y ) ) {
				continue;
			}
			let vary = false;
			map[ to1d( x, y, 32 ) ] = createTile( oneOf( types ), x, y );
			let n = norm( rand(), 0, 1, 1, 4 );
			let m = { x: 0, y: 0 };
			if( y === iy ) {
				m.y = -1;
				vary = true;
			} else if( x === ix ) {
				m.x = -1;
				vary = true;
			} else if( x === ix - 1 + r ) {
				m.x = 1;
				vary = true;
			} else if( y === iy - 1 + r ) {
				m.y = 1;
				vary = true;
			}

			if( vary ) {
				for( let i = 1; i <= n; i++ ) {
					let nx = x + i * m.x;
					let ny = y + i * m.y;
					if( inBounds( nx, ny ) ) {
						map[ to1d( nx, ny, 32 ) ] = createTile( oneOf( types ), nx, ny );
					}
				}
			}
		}
	}
}

function outline( ix, iy, find, repl, map ) {
	for( let y = iy - 32; y < iy + 32; y++ ) {
		if( y < 0 ) {
			continue;
		}
		for( let x = 0; x < 32; x++ ) {
			if( adjTo( x, y, map, find ) ) {
				map[ to1d( x, y, 32 ) ] = createTile( repl, x, y );
			}
		}
	}
}

function lake( ix, iy, a, b, map ) {
	clump( ix, iy, [ a ], map );
	outline( ix, iy, a, b, map );
}

function w( y, map ) {
	let si = to1d( 0, y, 32 );
	for( let i = 0; i < 32; i++ ) {
		map[ i + si ] = createTile( 'w', i, y );
		map[ i - 32 + si ] = createTile( 'w', i, y - 1 );
		map[ i + 32 + si ] = createTile( 'w', i, y + 1 );
	}
}

function gen( height, width ){
	let map = [];
	for( let y = 0; y < height; y++ ) {
		for( let x = 0; x < width; x++ ) {
			map.push( createTile( 'none', x, y ) );
		}
	}
	for( let y = 0; y < 266; y++ ) {
		for( let x = 0; x < width; x++ ) {
			map[ to1d( x, y, 32 ) ] = createTile( rand() > 0.5 ? 'tr' : 'gr', x, y );
		}
	}
	for( let y = 266; y < 533; y++ ) {
		for( let x = 0; x < width; x++ ) {
			map[ to1d( x, y, 32 ) ] = createTile( 'tr', x, y );
		}
	}
	for( let y = 533; y < 800; y++ ) {
		for( let x = 0; x < width; x++ ) {
			map[ to1d( x, y, 32 ) ] = createTile( 'rock', x, y );
		}
	}
	for( let i = 0; i < 6; i++ ) {
		let x = norm( rand(), 0, 1, 0, 31 );
		let y = norm( rand(), 0, 1, 50, 266 );
		clump( x, y, [ 'dirt' ], map );
	}
	for( let i = 0; i < 24; i++ ) {
		let x = norm( rand(), 0, 1, 0, 31 );
		let y = norm( rand(), 0, 1, 50, 400 );
		clump( x, y, [ 'mtn' ], map );
	}
	for( let i = 0; i < 20; i++ ) {
		let x = norm( rand(), 0, 1, 0, 31 );
		let y = norm( rand(), 0, 1, 50, 400 );
		lake( x, y, 'wtr', 'shore', map );
	}
	for( let i = 0; i < 10; i++ ) {
		let x = norm( rand(), 0, 1, 0, 31 );
		let y = norm( rand(), 0, 1, 50, 400 );
		clump( x, y, [ 'tr' ], map );
	}
	for( let i = 0; i < 10; i++ ) {
		let x = norm( rand(), 0, 1, 0, 5 );
		let y = norm( rand(), 0, 1, 0, 266 );
		clump( x, y, [ 'gr' ], map );
	}
	for( let i = 0; i < 40; i++ ) {
		let x = norm( rand(), 0, 1, 0, 20 );
		let y = norm( rand(), 0, 1, 266, 533 );
		clump( x, y, [ 'mtn', 'mtn2' ], map );
	}
	for( let i = 0; i < 20; i++ ) {
		let x = norm( rand(), 0, 1, 0, 20 );
		let y = norm( rand(), 0, 1, 420, 800 );
		clump( x, y, [ 'mtn2' ], map );
	}
	for( let i = 0; i < 30; i++ ) {
		let x = norm( rand(), 0, 1, 0, 25 );
		let y = norm( rand(), 0, 1, 566, 770 );
		lake( x, y, 'lava', 'lshore', map );
	}
	w( 0, map );
	w( 276, map );
	w( 533, map );

	return map;
}

terrain.set = function() {
	seed = 123456;
	let n_tiles_y = 800;
	let n_tiles_x = 32;
	let map = gen( n_tiles_y, n_tiles_x );
	let canv = current_canv = document.createElement( 'canvas' );
	canv.width = n_tiles_x * tile_width;
	canv.height = n_tiles_y * tile_height;
	display.setCanv( canv );
	map.forEach( ( t ) => {
		drawTile( t, canv );
	} );
	display.restoreCanv();
	terrain.height = canv.height;

	// draws the map and embeds it on the page as a png so it can be downloaded
	// console.log( 'CANVAS', canv );
	// let img = canv.toDataURL( 'image/png' );
	// document.write( '<img src="'+img+'"/>' );
};

function drawTile( tile, canvas ) {
	let f = Math.floor;
	let tx = tile.x * tile_width + tile_width / 2;
	let ty = canvas.height - tile_height - tile.y * tile_height + tile_height / 2;
	display.ctx.save();
	display.rect( { x: tx, y: ty, w: tile_width, h: tile_height, color: tile.bg } );
	if( tile.type === 'gr' || tile.type === 'tr' || tile.type.indexOf( 'rock' ) > -1 ) {
		let nrects = 1 + Math.floor( rand() * 5 );
		for( let i = 0; i < nrects; i++ ) {
			let x = tx + f( rand() * tile_width );
			let y = ty + f( rand() * tile_height );
			let r = f( rand() * tile_width );
			display.circle( { x, y, r, color: oneOf( tile.ref.bg ) } );
		}
	}
	display.ctx.restore();
	text_params.color = tile.fg;
	display.drawText( tile.ch, tx + tx_offset, ty + ty_offset, text_params );
}

terrain.getYOffset = function( offset ) {
	return -current_canv.height + display.height + offset;
};

terrain.draw = function( offset ) {
	display.ctx.drawImage( current_canv, 0, terrain.getYOffset( offset ) );
};

} )();
