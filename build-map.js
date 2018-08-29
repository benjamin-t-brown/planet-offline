
console.log( './map/map1.json' );
const map = require( './map/map1.json' );
const layer = getLayer( map.layers, 'Object Layer 1' );

function pxXToTileX( px_x ) {
	return Math.floor( px_x / 25 );
}
function pxYToTileY( px_y ) {
	return Math.floor( px_y / 32 );
}
function pxToTileDimensions( obj ) {
	return {
		x: pxXToTileX( obj.x ),
		y: 800 - pxYToTileY( obj.y ),
		w: pxXToTileX( obj.width || 32 ),
		h: pxYToTileY( obj.height || 25 )
	};
}

function getLayer( layers, layer_name ) {
	for( let i in layers ) {
		const layer = layers[ i ];
		if( layer.name === layer_name ) {
			return layer;
		}
	}
	throw( 'Malformed tiled JSON, no layer found named "' + layer_name + '".' );
}

const commands = {
	'stop': ( o ) => {
		const d = pxToTileDimensions( o );
		const level = parseInt( o.name.slice( 'stop'.length ) );
		// arg type (sl for 'stop level'), y, num seconds to pause
		return [ 'sl', d.y, level ];
	},
	'start': ( o ) => {
		const d = pxToTileDimensions( o );
		const level = parseInt( o.name.slice( 'start'.length ) );
		// arg type (bl for 'begin level'), y, num seconds to pause
		return [ 'bl', d.y, level ];
	},
	'ground': ( o ) => {
		const d = pxToTileDimensions( o );
		const level = parseInt( o.name.slice( 'ground'.length, ) );
		// arg type ('g' for ground), x, y, ground level
		return [ 'g', d.x, d.y, level ];
	},
	'spawn_c': ( o ) => {
		const d = pxToTileDimensions( o );
		const arr = o.name.split( ':' );
		const type = arr[ 1 ].split( ',' )[ 0 ];
		const typelevel = parseInt( type.slice( 'air'.length ) );
		const amount = arr[ 1 ].split( ',' )[ 1 ];
		//arg type (s for 'spawn'), y, spawn location, spawn type, type level, amount to spawn
		return ['s', d.y, 'c', 'a', typelevel, amount ];
	},
	'spawn_l': ( o ) => {
		const d = pxToTileDimensions( o );
		const arr = o.name.split( ':' );
		const type = arr[ 1 ].split( ',' )[ 0 ];
		const typelevel = parseInt( type.slice( 'air'.length ) );
		const amount = arr[ 1 ].split( ',' )[ 1 ];
		// arg type (s for 'spawn'), y, spawn location, spawn type, type level, amount to spawn
		return [ 's', d.y, 'l', 'a', typelevel, amount ];
	},
	'spawn_r': ( o ) => {
		const d = pxToTileDimensions( o );
		const arr = o.name.split( ':' );
		const type = arr[ 1 ].split( ',' )[ 0 ];
		const typelevel = parseInt( type.slice( 'air'.length ) );
		const amount = arr[ 1 ].split( ',' )[ 1 ];
		// arg type (s for 'spawn'), y, spawn location, spawn type, type level, amount to spawn
		return [ 's', d.y, 'r', 'a', typelevel, amount ];
	},
	'spawn_a': ( o ) => {
		const d = pxToTileDimensions( o );
		const arr = o.name.split( ':' );
		const type = arr[ 1 ].split( ',' )[ 0 ];
		const typelevel = parseInt( type.slice( 'air'.length ) );
		const amount = arr[ 1 ].split( ',' )[ 1 ];
		// arg type (s for 'spawn'), y, spawn location, spawn type, type level, amount to spawn
		return [ 's', d.y, 'a', 'a', typelevel, amount ];
	},
	'pause': ( o ) => {
		const d = pxToTileDimensions( o );
		const numseconds = parseInt( o.name.slice( 'pause'.length ) );
		// arg type (p for 'pause'), y, num seconds to pause
		return [ 'p', d.y, numseconds ];
	},
	'cache': ( o ) => {
		const d = pxToTileDimensions( o );
		let hp = parseInt( o.name.split( ',' )[ 0 ].slice( 'cache'.length ) );
		if( isNaN( hp ) ) {
			hp = 10;
		}
		const what = o.name.split( ',' )[ 1 ];
		// arg type (c for 'cache'), x, y, cache hp, what spawns when it dies
		return [ 'c', d.x, d.y, hp, what ];
	},
	'uplink': ( o ) => {
		const d = pxToTileDimensions( o );
		const numseconds = parseInt( o.name.slice( 'uplink'.length ) );
		if( isNaN( numseconds ) ) {
			console.error( 'Invalid uplink node', o );
			process.exit( 0 );
		}
		// arg type (u for 'uplink'), x, y, num seconds required to uplink
		return [ 'u', d.x, d.y, numseconds ];
	},
	'wait': ( o ) => {
		const d = pxToTileDimensions( o );
		const numseconds = parseInt( o.name.slice( 'wait'.length, o.name.indexOf( '|' ) ) );
		const spawncmd = o.name.split( '|' )[ 1 ];

		o.name = spawncmd;

		// arg type (w for 'wait'), x, y, num seconds to wait before spawning, ...spawn command
		return [ 'w', d.y, numseconds ].concat( commands.parseObject( o ) );
	},
	'text': ( o ) => {
		const d = pxToTileDimensions( o );
		const text = o.name.split( ',' )[ 1 ];
		return [ 't', d.x, d.y, text ];
	},
	'parseObject': ( o ) => {
		for( let cmd_name in commands ) {
			if( o.name.slice( 0, 4 ) === 'wait' ) {
				return commands.wait( o );
			} else if( o.name.indexOf( cmd_name ) === 0 ) {
				return commands[ cmd_name ]( o );
			}
		}
		console.log( 'WARNING', 'no command named:', o.name );
		return null;
	}
};

let res = [];

layer.objects.forEach( ( o ) => {
	res.push( commands.parseObject( o ) );
} );

res = res.filter( ( r ) => {
	return r ? true : false;
} ).map( ( arr ) => {
	return arr.join( ',' );
} ).join( '|' );

const out = `( function() {
window.app.level = "${res}";
} )();
`;

console.log( res );
require( 'fs' ).writeFileSync( './levels.js', out );

