( function() {
	let display = window.app.display;

	let cs = display.createSprite.bind( display );

	let air_sz = 40;
	let gr_w = 25 * 3;
	let gr_h = 32 * 3;

	let frect = function( { c, x, y, w, h, rot, o } ) {
		return {
			type: 'rect',
			c: c || 'red',
			w: w || 25,
			h: h || 32,
			x: x || 0,
			y: y || 0,
			rot,
			outline: o
		};
	};

	let fcircle = function( { c, r, x, y } ) {
		return {
			type: 'circle',
			c: c || 'rgba(220,220,220,1.0)',
			r: r || 2,
			x : x || 0,
			y : y || 0
		};
	};

	let pl_sz = 30;
	let pl2 = [ {
		//body
		c: '#111',
		w: pl_sz + 2,
		h: pl_sz + 2,
		rot: 45
	}, {
		c: '#44F',
		w: pl_sz,
		h: pl_sz,
		rot: 45
	}, {
		c: '#0AF',
		w: pl_sz / 2,
		h: pl_sz / 2,
		rot: 45
	}, {
		//right
		c: '#111',
		w: pl_sz / 2,
		h: pl_sz / 2,
		y: 20,
		x: 20
	}, {
		c: '#44F',
		w: pl_sz / 2,
		h: pl_sz / 2,
		y: 20,
		x: 20
	}, {
		c: '#77A',
		w: 6,
		h: pl_sz,
		y: 0,
		x: 20
	}, {
		//left
		c: '#111',
		w: pl_sz / 2,
		h: pl_sz / 2,
		y: 20,
		x: -20
	}, {
		c: '#44F',
		w: pl_sz / 2,
		h: pl_sz / 2,
		y: 20,
		x: -20
	}, {
		c: '#77A',
		w: 6,
		h: pl_sz,
		y: 0,
		x: -20
	} ];

	let air = [ {
		w: air_sz,
		h: air_sz,
		rot: 0
	}, {
		w: air_sz,
		h: air_sz,
		rot: 22.5
	}, {
		w: air_sz,
		h: air_sz,
		rot: 30
	}, {
		w: air_sz,
		h: air_sz,
		rot: 45
	}, {
		w: air_sz,
		h: air_sz,
		rot: 60
	}, {
		w: air_sz,
		h: air_sz,
		rot: 67.5
	}, {
		w: air_sz / 2,
		h: air_sz / 2
	}, {
		w: air_sz / 4,
		h: air_sz / 4,
		rot: 45
	} ];

	let ground = [
		frect( {
		} ),
		frect( {
			w: 50,
			h: 64
		} ),
		frect( {
		} ),
		frect( {
			x: -25 * 1,
		} ),
		frect( {
			x: 25 * 1,
		} ),
		frect( {
			y: -32 * 1,
		} ),
		frect( {
			y: 32 * 1,
		} ),
	];

	let cache = [ {
		type: 'circle',
		r: 25 + 2
	}, {
		type: 'circle',
		r: 25
	}, {
		type: 'circle',
		r: 25 - 4
	}, {
		type: 'circle',
		r: 25 - 10
	}, {
		type: 'circle',
		r: 25 - 16
	}, {
		w: 5,
		h: 10
	} ];

	let sprites = window.app.sprites = {
		air_sz: air_sz,
		pl_sz: 35,
		get: function( name, cs ) {
			let p = name === 'air' ? air
				: name === 'ground' ? ground
				: name === 'cache' ? cache
				: [];
			return JSON.parse( JSON.stringify( p ) ).map( ( shape, i ) => {
				shape.c = cs[ i ];
				return shape;
			} );
		},

		createSprites() {
			let white = [];
			for ( let i = 0; i < 20; i++ ) {
				white.push( '#FFF' );
			}

			cs( 'none', 0, [ fcircle( { r: 10 } ) ], 9, 9 );

			function opacity( c ) {
				return `rgba(220,220,220,${c})`;
			}

			cs( 'expl0', 5, [ fcircle( { r: 2 } ) ], 99, 99 );
			cs( 'expl1', 5, [ fcircle( { r: 15 } ) ], 99, 99 );
			cs( 'expl2', 5, [ fcircle( { r: 30 } ) ], 99, 99 );
			cs( 'expl3', 5, [ fcircle( { r: 38, c: opacity( 0.6 ) } ) ], 99, 99 );
			cs( 'expl4', 5, [ fcircle( { r: 40, c: opacity( 0.3 ) } ) ], 99, 99 );

			cs( 'expl5', 5, [ fcircle( { r: 1, c: opacity( 0.8 ) } ) ], 99, 99 );
			cs( 'expl6', 5, [ fcircle( { r: 8, c: opacity( 0.8 ) } ) ], 99, 99 );
			cs( 'expl7', 5, [ fcircle( { r: 15,c: opacity( 0.8 ) } ) ], 99, 99 );
			cs( 'expl8', 5, [ fcircle( { r: 19, c: opacity( 0.6 ) } ) ], 99, 99 );
			cs( 'expl9', 5, [ fcircle( { r: 20, c: opacity( 0.3 ) } ) ], 99, 99 );

			cs( 'expl10', 5, [ fcircle( { r: 2, c: '#FF0' } ) ], 25, 25 );
			cs( 'expl11', 5, [ fcircle( { r: 10, c: '#FF0' } ) ], 25, 25 );
			cs( 'expl12', 5, [ fcircle( { r: 12, c: '#FF0' } ) ], 25, 25 );

			cs( 'air1', 2, sprites.get( 'air', [
				'#077',
				'',
				'',
				'#084',
				'',
				'',
				'#0DD',
				''
			] ), air_sz * 2, air_sz * 2 );
			cs( 'air2', 2, sprites.get( 'air', [
				'#630',
				'',
				'#930',
				'',
				'#A30',
				'',
				'#A90',
				''
			] ), air_sz * 2, air_sz * 2 );
			cs( 'air3', 3, sprites.get( 'air', [
				'#7803C4',
				'',
				'#9720D2',
				'',
				'#B73DE0',
				'',
				'#D75AEE',
				'#F777FD'
			] ), air_sz * 2, air_sz * 2 );
			cs( 'air4', 4, sprites.get( 'air', [
				'#444',
				'#444',
				'',
				'#444',
				'',
				'#444',
				'#777',
				'#999'
			] ), air_sz * 2, air_sz * 2 );
			for( let i = 1; i <= 4; i++ ) {
				cs( `air${i}dmg`, 2, sprites.get( 'air', white ), air_sz * 2, air_sz * 2 );
			}

			cs( 'ground1', 0, sprites.get( 'ground', [
				'#BBB',
				'#981',
				'#666',
				'#878',
				'#878',
				'#878',
				'#878',
			] ), gr_w, gr_h );
			cs( 'ground2', 0, sprites.get( 'ground', [
				'#BBB',
				'#666',
				'#999',
				'#999',
				'#999',
				'#999',
				'#878',
			] ), gr_w, gr_h );
			cs( 'ground3', 0, sprites.get( 'ground', [
				'#BBB',
				'#666',
				'#999',
				'#999',
				'#999',
				'#999',
				'#878',
			] ), gr_w, gr_h );
			for( let i = 1; i <= 3; i++ ) {
				cs( `ground${i}dmg`, 0, sprites.get( 'ground', white ), gr_w, gr_h );
			}

			cs( 'grounddead', 0, sprites.get( 'ground', [
				'#111',
				'#222',
				'#333',
				'#676',
				'#565',
				'#676',
				'#454',
			] ), gr_w, gr_h );

			cs( 'turret1', 0, [
				frect( {
					c: '#333',
					w: 12,
					h: 30,
				} ),
				frect( {
					c: '#981',
					w: 16,
					h: 16,
					y: -15
				} )
			], gr_w, gr_h );

			cs( 'turret2', 0, [
				frect( {
					c: '#333',
					w: 8,
					h: 30,
					x: -5
				} ),
				frect( {
					c: '#333',
					w: 8,
					h: 30,
					x: 5
				} ),
			], gr_w, gr_h );

			cs( 'turret3', 0, [
				frect( {
					c: '#333',
					w: 5,
					h: 30,
					x: -6
				} ),
				frect( {
					c: '#333',
					w: 5,
					h: 30
				} ),
				frect( {
					c: '#333',
					w: 5,
					h: 30,
					x: 6
				} ),
			], gr_w, gr_h );

			cs( 'lazer1', 0, [ {
				c: '#FFF',
				w: 4,
				h: 14
			} ], 4, 20 );
			cs( 'lazer2', 0, [ {
				c: '#0FF',
				w: 4,
				h: 20
			}, {
				c: '#FFF',
				w: 2,
				h: 16
			} ], 4, 20 );
			cs( 'lazer3', 0, [ {
				c: '#FF0',
				r: 4
			}, {
				type: 'circle',
				c: '#FFF',
				r: 3
			} ], 12, 12 );

			cs( 'bomb1', 0, [ {
				type: 'circle',
				c: '#4AA',
				r: 7
			}, {
				type: 'circle',
				c: '#0FF',
				r: 5
			}, {
				type: 'circle',
				c: '#FFF',
				r: 2
			} ], 14, 14 );

			cs( 'bullet1', 0, [ {
				type: 'circle',
				c: '#900',
				r: 7
			}, {
				type: 'circle',
				c: '#F88',
				r: 5
			}, ], 12, 12 );

			cs( 'bullet2', 0, [ {
				type: 'circle',
				c: '#990',
				r: 8
			}, {
				type: 'circle',
				c: '#FF8',
				r: 6
			} ], 14, 14 );

			cs( 'bullet3', 0, [ {
				type: 'circle',
				c: '#909',
				r: 9
			}, {
				type: 'circle',
				c: '#F8F',
				r: 7
			} ], 12, 12 );

			cs( 'btgt', 3, [ {
				c: '#C44',
				rot: 45,
				w: 2,
				h: 14
			}, {
				c: '#C44',
				rot: -45,
				w: 2,
				h: 14
			} ], 50, 50 );

			const c1 = [
				'#111',
				'#555',
				'#344',
				'#466',
				'#599',
				'#FF1',
				'#3A5',
				'#3A5',
				'#3A5',
				'#3A5'
			];
			cs( 'cache0', 0, sprites.get( 'cache', c1 ), 65, 65 );
			const c2 = c1.slice();
			c2[ 2 ] = '#354';
			c2[ 3 ] = '#476';
			c2[ 4 ] = '#6A9';
			cs( 'cache1', 0, sprites.get( 'cache', c2 ), 65, 65 );
			const c3 = c1.slice();
			c3[ 2 ] = '#355';
			c3[ 3 ] = '#486';
			c3[ 4 ] = '#6AA';
			cs( 'cache2', 0, sprites.get( 'cache', c3 ), 65, 65 );
			const c4 = c1.slice();
			c4[ 1 ] = '#111';
			c4[ 2 ] = '#111';
			c4[ 3 ] = '#222';
			c4[ 4 ] = '#222';
			c4[ 5 ] = '#111';
			cs( 'cachedead', 0, sprites.get( 'cache', c4 ), 65, 65 );
			cs( 'cachedmg', 0, sprites.get( 'cache', white ), 65, 65 );

			cs( 'flash1', 0, [ {
				c: '#FFF',
				rot: 45,
				w: 2,
				h: 12,
				y: -10
			}, {
				c: '#FFF',
				rot:-45,
				w: 2,
				h: 12,
				y: -10
			} ], 50, 50 );

			cs( 'target', 0, [ {
				c: '#0F0',
				rot: 45,
				w: 2,
				h: 18
			}, {
				c: '#0F0',
				rot:-45,
				w: 2,
				h: 18
			} ], 50, 50 );

			cs( 'pwrhp', 0, [
				fcircle( { r: 18, c: '#111' } ),
				fcircle( { r: 16, c: '#55F' } ),
				frect( { x: -6, w: 10, h: 4, c: '#FFF' } ),
				frect( { x: -11, w: 4, h: 14, c: '#FFF' } ),
				frect( { x: -1, w: 4, h: 14, c: '#FFF' } ),
				frect( { x: 5, w: 4, h: 14, c: '#FFF' } ),
				fcircle( { x: 10, y: -2, r: 5, c: '#FFF' } ),
				fcircle( { x: 10, y: -2, r: 2, c: '#111' } )
			], 99, 99 );

			cs( 'pwrlazer', 0, [
				fcircle( { r: 22, c: '#EEE' } ),
				fcircle( { r: 20, c: '#F92' } ),
				frect( { w: 6, h: 20, c: '#FFF' } ),
				frect( { w: 20, h: 5, c: '#FFF' } )
			], 99, 99 );

			cs( 'pc0', 0, [
				fcircle( { r: 12, c: '#FF0' } ),
				fcircle( { r: 10, c: '#AA0' } ),
			], 99, 99 );
			cs( 'pc1', 0, [
				fcircle( { r: 12, c: '#FF0' } ),
				fcircle( { r: 10, c: '#AA0' } ),
				frect( { x: -3, y: -2, w: 3, h: 1, c: '#FFF', o: 0 } ),
				frect( { x: -3, y: -2, w: 2, h: 3, c: '#FFF', o: 0 } )
			], 99, 99 );
			cs( 'pc2', 0, [
				fcircle( { r: 12, c: '#FF0' } ),
				fcircle( { r: 10, c: '#AA0' } ),
				frect( { x: -3, y: -2, w: 8, h: 1, c: '#FFF', o: 0 } ),
				frect( { x: -3, y: -2, w: 1, h: 8, c: '#FFF', o: 0 } )
			], 99, 99 );

			cs( 'pwr2x', 0, [
				frect( { rot: 45, w: 8, h: 30, c: '#F2F' } ),
				frect( { rot:-45, w: 8, h: 30, c: '#F2F' } )
			], 99, 99 );

			cs( 'harpoon', 0, [
				frect( { x: -5, y: 10, w: 4, h: 20, c: '#888' } ),
				frect( { x: 5, y: 10, w: 4, h: 20, c: '#888' } ),
				frect( { w: 20, h: 4, c: '#888' } ),
			], 99, 99 );

			cs( 'plug0', 0, [
				fcircle( { r: 29, c: '#111' } ),
				fcircle( { r: 28, c: '#555' } ),
				frect( { w: 25, h: 25, c: '#777' } ),
				frect( { x: -10, y:-12, w: 4, h: 25, c: '#AAA' } ),
				frect( { x: 10, y:-12, w: 4, h: 25, c: '#AAA' } ),
				frect( { w: 30, h: 4, c: '#AAA' } ),
			], 99, 99 );
			cs( 'plug1', 0, [
				fcircle( { r: 29, c: '#111' } ),
				fcircle( { r: 28, c: '#555' } ),
				frect( { w: 25, h: 25, c: '#777' } ),
				frect( { x: -10, y:-12, w: 4, h: 25, c: '#AAF' } ),
				frect( { x: 10, y:-12, w: 4, h: 25, c: '#AAF' } ),
				frect( { w: 30, h: 4, c: '#ABB' } ),
			], 99, 99 );
			cs( 'plug2', 0, [
				fcircle( { r: 29, c: '#111' } ),
				fcircle( { r: 28, c: '#555' } ),
				frect( { w: 25, h: 25, c: '#777' } ),
				frect( { x: -10, y:-12, w: 4, h: 25, c: '#AFF' } ),
				frect( { x: 10, y:-12, w: 4, h: 25, c: '#AFF' } ),
				frect( { w: 30, h: 4, c: '#AEE' } ),
			], 99, 99 );
			cs( 'plug4', 0, [
				fcircle( { r: 29, c: '#111' } ),
				fcircle( { r: 28, c: '#555' } ),
				frect( { w: 25, h: 25, c: '#777' } ),
				frect( { x: -10, y:-12, w: 4, h: 25, c: '#777' } ),
				frect( { x: 10, y:-12, w: 4, h: 25, c: '#777' } ),
				frect( { w: 30, h: 4, c: '#777' } ),
			], 99, 99 );

			let rpl = ( n ) => {
				let pl = JSON.parse( JSON.stringify( pl2 ) );
				for ( let i = 3; i < 9; i++ ) {
					pl[ i ].x = pl[ i ].x / n;
				}
				pl[ 2 ].w /= n;
				pl[ 2 ].h /= n;
				pl = [ pl[ 6 ], pl[ 7 ], pl[ 8 ] ].concat( [ pl[ 0 ], pl[ 1 ], pl[ 2 ], pl[ 3 ], pl[ 4 ], pl[ 5 ] ] );
				return pl;
			};
			cs( 'p4', 0, rpl( -2 ), 200, 200 );
			cs( 'p3', 0, rpl( -1.5 ), 200, 200 );
			cs( 'p2', 0, pl2, 200, 200 );
			cs( 'p1', 0, rpl( 1.5 ), 200, 200 );
			cs( 'p0', 0, rpl( 2 ), 200, 200 );
		}
	};
} )();
