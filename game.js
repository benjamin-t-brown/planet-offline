( function() {

let display = window.app.display;
let sprites = window.app.sprites;
let terrain = window.app.terrain;
let ls = localStorage;
let game;

let dh = display.height;
let dw = display.width;
let drawText = display.drawText;
let playSound = display.playSound;
let pause_name = '';

// terrain scroll speed
let TSS = 0.9;

let pInt = parseInt;

let black = ( o ) => {
	return `rgba(0,0,0,${o})`;
};

function hedWithinBand( dh, band ) {
	return dh < band || ( dh > ( 360 - band ) && dh < ( 360 ) );
}

// Everything on the screen that isnt the background terrain extends the Actor class.  (Also maybe
// some direct drawText calls in the main loop.)
class Actor {
	constructor( name ) {
		this.f = 0; // stands for 'frame', counter variable that incremented by one each frame
		this.name = name; // name, used to construct sprite
		this.speed = 6; //speed, pixels per frame
		this.mxsd = 4; // max speed, pixels per frame (if accelerating with accelerate func
		this.x = 0; // x position on screen, in pixels
		this.y = 0; // y position on screen, in pixels
		this.r = 10; // radius of circle used for collisions
		this.w = 10; // width (not really used)
		this.h = 10; // height (not really used)
		this.vx = 0; // x velocity, in pixels
		this.vy = 0; // y velocity, in pixels
		this.ax = 0; // turning velocity, in degrees per frame
		this.maxax = 1; // max turning velocity, in degrees per frame
		this.hp = 1; // hit points
		this.accel = 0.2; // rate of acceleration, in pixels per frame
		this.deccel = 0.05; // rate of decelleration if not accelerating, in pixels per frame
		this.hed = 0; //heading, in degrees
		this.isac = false; // is_accelerating
		this.remv = false; // if true, this actor will be removed by the game on the current frame
		this.state = ''; // animation state, used only by player
		this.expl = 'expl_air'; // explode animation name
		this.anim = null; // actor's animation, if it has one
		this.sprite = null; // actor's sprite, if it has one
		this.ai = function(){}; // the function that determines what this actor does every frame
	}

	setState( state ) {
		if( this.state === state ) {
			return;
		}
		this.state = state;
		this.anim = display.getAnim( this.name + '_' + state );
	}

	// GetHeadingTowards, given an x, y position, return the heading, in degrees that
	// would mean this actor was pointing towards the position
	getHedTo( { x, y } ){
		let leny = y - this.y;
		let lenx = x - this.x;
		let hyp = Math.sqrt( lenx*lenx + leny*leny );
		let ret = 0;
		if( y >= this.y && x >= this.x ){
			ret = ( Math.asin( leny / hyp ) * 180 / Math.PI ) + 90;
		} else if( y >= this.y && x < this.x ){
			ret = ( Math.asin( leny / -hyp ) * 180 / Math.PI ) - 90;
		} else if( y < this.y && x > this.x ){
			ret = ( Math.asin( leny / hyp ) * 180 / Math.PI ) + 90;
		} else {
			ret = ( Math.asin( -leny / hyp ) * 180 / Math.PI ) - 90;
		}
		if( ret >= 360 ) {
			ret = 360 - ret;
		}
		if( ret < 0 ) {
			ret = 360 + ret;
		}
		return ret;
	}

	// point at a position
	pointAt( { x, y } ) {
		this.hed = this.getHedTo( { x, y } );
	}

	turn( direction ) {
		if( direction === 'l' ) {
			this.ax = -this.maxax;
		} else {
			this.ax = this.maxax;
		}
	}

	// turn towards a position, limited by maxax
	turnTowards( { x, y } ){
		let h = this.getHedTo( { x, y } );

		if ( this.hed <= h ) {
			if ( Math.abs( this.hed - h ) < 180 ) {
				this.turn( 'r' );
			} else {
				this.turn( 'l' );
			}
		} else {
			if ( Math.abs( this.hed - h ) < 180 ) {
				this.turn( 'l' );
			} else {
				this.turn( 'r' );
			}
		}
	}

	// accelerate, up to max speed at intervals of this.accel
	acc() {
		let { x: maxvx, y: maxvy } = display.hedToVec( this.hed, this.mxsd );

		if( this.vx < maxvx ){
			this.vx += this.accel;
		} else if( this.vx > maxvx ){
			this.vx -= this.accel;
		}

		if( this.vy < maxvy ){
			this.vy += this.accel;
		} else if( this.vy > maxvy ){
			this.vy -= this.accel;
		}
		this.isac = true;
	}

	// deccelerate, as if air friction was slowing this actor down at intervals of this.deccel
	decc() {
		let maxvx = 0.0;
		let maxvy = 0.0;

		if( this.vx < maxvx ){
			this.vx += this.deccel;
		} else if( this.vx > maxvx ){
			this.vx -= this.deccel;
		}

		if( this.vy < maxvy ){
			this.vy += this.deccel;
		} else if( this.vy > maxvy ){
			this.vy -= this.deccel;
		}

		if( Math.abs( this.vx ) < 0.001 ) {
			this.vx = 0;
		}
		if( Math.abs( this.vy ) < 0.001 ) {
			this.vy = 0;
		}
	}

	// collides, does this actor collide with the given circle?
	coll( { x, y, r } ) {
		if( game.ncontrol ) {
			return false;
		}
		let d = display.distance( x, y, this.x, this.y );
		if( d < r + this.r && !this.remv ) {
			let ret = { x: this.x - x, y: this.y - y, d };
			return ret;
		}
	}

	// shortcut to mark actor as removed and add an explode particle
	explode() {
		this.remv = true;
		if( this.expl ) {
			game.addPar( this.expl, this.x, this.y );
		}
	}

	// fire a bullet, only used by GroundTank actors
	fire( type, level, n ) {
		let cb = () => {
			let v = 40;
			let h = this.hed - v / 2 + Math.random() * v;
			let b = new game.Bullet( level, h );
			let { x, y } = display.hedToVec( this.hed, 25 );
			b.x = this.x + x;
			b.y = this.y + y;
			game.actors.push( b );
			game.addPar( 'flash', b.x, b.y ).hed = this.hed;
			playSound( 'bullet' );
		};

		for( let i = 0; i < n; i++ ) {
			game.setCB( cb, i * 5 + 1, true );
		}
	}

	// inflict damage on this actor, if it would kill this actor, then explode
	damage( n ) {
		this.hp -= n;
		if( this.hp <= 0 ) {
			this.explode();
			return true;
		}
		return false;
	}

	update() {
		if( this.ai && !game.ncontrol ) {
			this.ai();
		}

		this.x += this.vx;
		this.y += this.vy;
		this.hed += this.ax;
		if( this.hed >= 360 ) {
			this.hed = this.hed - 360;
		}
		if( this.hed < 0 ) {
			this.hed = 360 + this.hed;
		}
		this.ax = 0;
		if( !this.isac ){
			this.decc();
		}
		this.isac = false;
		this.f++;
	}

	draw() {
		if( this.anim ) {
			display.drawAnim( this.anim, this.x, this.y, 1, this.hed );
		} else if( this.sprite ) {
			display.drawSprite( this.sprite, this.x, this.y );
		}
	}
}

class Player extends Actor {
	constructor() {
		super( 'pl' );
		this.x = 400;
		this.y = 400;
		this.r = 25;
		this.mtgy = -150; // max target y
		this.tgy = -150; // offset of the green target "x" where the bombs drop
		this.setState( 'default' );
		this.lzrcd = 20; // lazer cooldown
		this.lzfrm = 20; // lazer frame (counts cooldown)
		this.lzlvl = 1; // lazer level
		this.mhp = 100; //max hp
		this.hp = this.mhp;
		this.uplink = null; // reference to the current uplink (if there is one)
		this.bombs = []; // array that holds the bombs, can only drop one per 5 frames
		this.bfrm = 0; //bomb frame
	}

	// I made the game reduce points for firing this because players just held down 'z' the
	// entire game
	lazer() {
		if( this.lzfrm > this.lzrcd ) {
			this.lzfrm = 0;
			if( this.lzlvl === 1 ) {
				for( let i = 0; i < 3; i++ ) {
					let l = new game.Lazer( 1, true );
					let l2 = new game.Lazer( 1 );
					l.vy = l2.vy = -9;
					l.damage = l2.damage = 1;
					l.delay = l2.delay = i * 3;
					l.x_offset = -5;
					l2.x_offset = 5;
					game.actors.push( l, l2 );
				}
			} else if( this.lzlvl === 2 ) {
				for( let i = 0; i < 4; i++ ) {
					for( let x = -10; x <= 10; x += 10 ) {
						let l = new game.Lazer( 2, x === -10 );
						l.vy = -14;
						l.damage = 3;
						l.delay = i * 3;
						l.x_offset = x;
						game.actors.push( l );
					}
				}
			} else if( this.lzlvl === 3 ) {
				for( let j = 0; j < 4; j++ ){
					for( let i = 1; i < 6; i++ ) {
						let l = new game.Lazer( 3, i === 1 );
						l.vx = display.normalize( i, 0, 6, -3, 3 );
						l.delay = j * 3;
						l.damage = 5;
						l.x_offset = l.vx;
						game.actors.push( l );
					}
				}
			}
			game.score -= 10;
		}
	}
	bomb() {
		if( this.bombs.length === 0 ) {
			let nbombs = [ 0, 1, 2, 4 ][ game.lvln ];
			for( let i = 0; i < nbombs; i++ ) {
				let b = new game.Bomb( 1, this.x, this.y, this.tgy );
				this.bombs.push( b );
			}
		}
	}
	harpoon() {
		if( !this.uplink ) {
			let h = new game.Harpoon( 1, this.x, this.y );
			this.uplink = h;
			playSound( 'har' );
			game.actors.push( h );
		}
	}

	// If the player explodes, the game is over
	explode() {
		if( !game.ncontrol ) {
			playSound( 'lvlf' );
			game.end();
		}
	}

	// Add HP to the player, (used by HP powerup), but dont let hp get above max
	plusHP( n ) {
		let a = this.hp += n;
		if( a > this.mhp ) {
			this.hp = this.mhp;
		}
	}
	update() {
		let is_turning = false;
		if( game.keys.arrowleft ) {
			is_turning = true;
			this.x -= this.speed;
		} if( game.keys.arrowright ) {
			is_turning = true;
			this.x += this.speed;
		} if( game.keys.arrowup ) {
			this.y -= this.speed;
		} if( game.keys.arrowdown ) {
			this.y += this.speed;
		} else {
			this.tgy -= 4;
			if( this.tgy < this.mtgy ) {
				this.tgy = this.mtgy;
			}
		}
		if( game.keys.z ) {
			this.lazer();
		}
		if( !is_turning && ( this.state === 'left' || this.state === 'right' ) ) {
			if( this.state === 'left' ) {
				this.setState( 'from_left' );
			} else {
				this.setState( 'from_right' );
			}
		}
		if( this.x < 0 ) {
			this.x = 0;
		} else if( this.x > dw ) {
			this.x = dw;
		} else if( this.y < 0 ) {
			this.y = 0;
		} else if( this.y > dh ) {
			this.y = dh;
			if( game.keys.arrowdown ) {
				this.tgy += 4;
				if( this.tgy > 0 ) {
					this.tgy = 0;
				}
			}
		}
		this.lzfrm++;

		if( this.uplink && this.uplink.remv ) {
			this.uplink = null;
		}

		if( this.bombs.length ) {
			if( this.bfrm <= 0 ) {
				this.bfrm = 4;
				playSound( 'bomb' );
				game.actors.push( this.bombs.shift() );
			} else {
				this.bfrm--;
			}
		}
	}
	draw() {
		super.draw();
		display.drawSprite( 'target', this.x, this.y + this.tgy );

		// Drawing the hp bar in here saves like maybe 4 bytes I think
		let hpw = 160;
		let chpw = display.normalize( this.hp, 0, this.mhp, 0, hpw );
		let hph = 10;
		let hpy = dh - hph - 2;
		let hpx = dw - hpw + hpw / 2 - 20;
		let chpx = dw - hpw + chpw / 2 - 20;
		display.rect( {
			x: hpx,
			y: hpy,
			w: hpw,
			h: hph,
			c: 'red',
			outline: 1
		} );
		display.rect( {
			x: chpx,
			y: hpy,
			w: chpw,
			h: hph,
			c: 'blue',
			outline: 1
		});
		let chpct = Math.round( this.hp * 100 / this.mhp ) + '%';
		drawText( chpct, hpx - chpct.length * 6.5, hpy + 2, { size: 24, color: 'white' } );
	}
}

// All the things flying at the player from offcreen are classified as Air
class Air extends Actor {
	constructor( name ) {
		super( name );
		this.sprite = name;
		this.expl = 'expl_air';
		this.level = parseInt( name.slice( -1 ) );

		// this.level starts at index 1, so the first value in these arrays is just 0
		this.dmg = [ 0, 3, 5, 8, 10 ][ this.level ];
		this.mxsd = [ 0, 4, 5, 6, 7 ][ this.level ];
		this.hp = [ 0, 1, 5, 15, 20 ][ this.level ];
		this.maxax = [ 0, 1, 1, 1.5, 2 ][ this.level ];
		this.ai = () => {
			let pl = game.player;

			if( this.f > 7 * 60 ) {
				this.hed = 180;
				this.acc();
			} else if( this.f > 9 * 60 ) {
				this.explode();
			} else {
				if( this.y > 200 ) {
					this.turnTowards( pl );
					let dist = display.distance( this.x, this.y, pl.x, pl.y );
					if( dist > 40 ) {
						let dh = Math.abs( this.hed - this.getHedTo( pl ) );
						if( hedWithinBand( dh, 90 ) ) {
							this.acc();
						}
					}
				} else {
					this.acc();
				}
			}
		};
	}

	damage( n ) {
		super.damage( n );
		this.anim = display.getAnim( this.name + 'dmg' );
		game.setCB( () => {
			if( !this.dead ) {
				this.anim = display.getAnim( this.name );
			}
		}, 6, true );
	}

	explode() {
		super.explode();
		playSound( 'expa' );
		game.aPts( this.level * 50 );
	}

	update() {
		super.update();
		let pl = game.player;
		let collision = this.coll( { x: pl.x, y: pl.y, r: sprites.pl_sz } );
		if( collision ) {
			playSound( 'hit' );
			this.explode();
			game.player.damage( this.dmg );
		}
	}
}

class Ground extends Actor {
	constructor( name, x, y ) {
		super( name );
		this.tx = x;
		this.ty = y;
		this.w = 25 * 3;
		this.h = 32 * 3;
		this.x = x * 25;
		this.r = this.w / 2;
		this.sprite = name;
		this.level = parseInt( name.slice( -1 ) );
		this.deadsprite = 'grounddead';
		//this.expl = 'expl_ground';
		this.anim = display.getAnim( name );
		this.maxax = 2;
		this.dead = false;
	}

	// ground targets needed a good explosion because they're a bit tougher to take down, so this
	// spawns 5 explode particles instead of one, randomly above the target.
	explode() {
		let v = 50;
		for( let i = 0; i < 5; i++ ) {
			game.addPar( this.expl, this.x - v / 2 + Math.random() * v, this.y - v / 2 + Math.random() * v );
		}
		this.anim = display.getAnim( this.deadsprite );
		this.dead = true;
	}

	// When damaging a ground target, players wanted to know if the bomb hit with a visual queue,
	// so this function turns them white for 6 frames before returning them to their default
	// sprite
	damage( n ) {
		super.damage( n );
		if( !this.dead ) {
			this.anim = display.getAnim( this.name + 'dmg' );
			game.setCB( () => {
				if( !this.dead ) {
					this.anim = display.getAnim( this.name );
				}
			}, 6, true );
		}
	}

	// terrain is drawn bottom up.  (0,0) is the bottom left of the terrain, and offseting
	// it by y is moving it downwards.  800 here is the size of the height of the screen.
	getY() {
		return ( 800 - this.ty ) * 32 + terrain.getYOffset( game.tyoff );
	}

	// This function has a leeway band of 100 pixels, because some stuff was marked with a
	// radius of 50, and you could clearly see it on the screen even though this function
	// was marking them as not visible.
	isVisible() {
		let y = this.getY();
		return y >= -100 && y <= dh + 100;
	}

	update() {
		this.y = this.getY();
		super.update();
	}

	draw() {
		if( this.isVisible() ) {
			let y = this.getY();
			let x = this.tx * 25;
			display.drawAnim( this.anim, x, y );
			if( !this.dead && this.turret_anim ) {
				display.drawAnim( this.turret_anim, x, y, 1, this.hed );
			}
		}
	}
}

class GroundTank extends Ground {
	constructor( name, x, y ) {
		super( name, x, y );
		this.turret_anim = display.getAnim( 'turret' + this.level );
		this.hp = [ 0, 6, 12, 16 ][ this.level ];

		// number of frames before turret can fire.  Theres this weird bug that happens
		// where sometimes the turrets fire double the bullets at half the rate, but I
		// liked that mechanic enough that I never bothered trying to fix it
		this.firerate = [ 0, 170, 130, 100 ][ this.level ];
		this.ai = () => {
			let pl = game.player;
			if( !this.dead && this.getY() > 50 && this.getY() < dh ) {
				this.turnTowards( pl );
				let dh = Math.abs( this.hed - this.getHedTo( pl ) );
				if( hedWithinBand( dh, 25 ) ) {
					if( display.frame % this.firerate === 0 ) {
						this.fire( 'bullet', this.level, 8 );
					}
				}
			}
		};
	}

	explode() {
		super.explode();
		if( !game.ncontrol ) {
			playSound( 'expg' );
		}
		game.aPts( this.level * 200 );
	}
}

class GroundCache extends Ground {
	constructor( x, y, hp, what ) {
		super( 'cache', x, y );
		this.hp = hp;
		this.deadsprite = 'cachedead';
		this.wh = what;
	}

	explode() {
		super.explode();
		if( this.wh === 'hp' ) {
			game.addPowerup( 'hp', this.x, this.y, 0, 1);
		} else if( this.wh.indexOf( 'coin' ) > -1 ) {
			let amt = parseInt( this.wh.slice( 4 ) );
			for( let i = 0; i < amt; i++ ) {
				game.addPowerup( 'coin', this.x, this.y, Math.random() * 6 - 3, Math.random() * 6 - 3 );
			}
		} else if( this.wh === 'lazer' ) {
			game.addPowerup( 'lazer', this.x, this.y, 0, 1 );
		} else if( this.wh === '2x' ) {
			game.addPowerup( '2x', this.x, this.y, 0, 1 );
		}
		game.aPts( 100 );
		if( pause_name === 61 ) {
			game.go( 1 );
		}
	}
}

class GameControl extends Ground {
	constructor( y ) {
		super( 'none', 10, y );
		this.loc = 'c'; // spawn location
		this.level = 1; // spawn level
		this.amt = 5; // spawn amount
		this.wait = 0; // time to wait before spawning
		this.pause_seconds = 0; //number of seconds to pause scrolling
		this.begin_level = 0; //index of the beginning of the level this GameControl represents
		this.end_level = 0; //index of the end of level this GameControl represents
	}

	update() {
		if( this.isVisible() ) {
			this.remv = true;
			if( this.pause_seconds ) { // pause control
				pause_name = this.pause_seconds;
				game.tss = 0;
				game.setCB( () => {
					game.tss = TSS;
				}, this.pause_seconds * 60, true );
			} else if( this.wait ) { // wait then spawn control
				game.setCB( () => {
					for( let i = 0; i < this.amt; i++ ) {
						game.spawns.push( this.loc + ',air' + this.level );
					}
				}, this.wait * 60, true );
			} else if( this.end_level ) { // end level control
				game.endLevel();
			} else { // spawn control
				for( let i = 0; i < this.amt; i++ ) {
					game.spawns.push( this.loc + ',air' + this.level );
				}
			}
		}
	}

	draw() {

	}
}

class Plug extends Ground {
	constructor( name, x, y, seconds ) {
		super( name + '1', x, y );
		this.anim = display.getAnim( 'plug' );
		this.deadanim = display.getAnim( 'plugdead' );
		this.r = 25;
		this.nframes = 60 * seconds;
		this.ai = function(){};
	}
	draw() {
		if( this.isVisible() ) {
			let y = this.getY();
			let x = this.tx * 25;
			if( this.dead ) {
				display.drawAnim( this.deadanim, x, y );
			} else {
				display.drawAnim( this.anim, x, y );
			}
		}
	}
}

class Particle extends Actor {
	constructor( anim_name, x, y ) {
		super( 'p' );
		this.x = x;
		this.y = y;
		this.anim = display.getAnim( anim_name );
	}

	update() {
		super.update();
		if( this.anim.is_done ) {
			this.remv = true;
		}
	}
}

class ParticleGround extends Particle {
	constructor( anim_name, x, y ) {
		super( anim_name, x, y );
	}

	update() {
		super.update();
		this.y += game.tss;
	}
}

class TextParticle extends Particle {
	constructor( text, x, y, is_ground ) {
		super( 'expl_air', x, y );
		this.text = text;
		this.vy = -1;
		this.color = '#FFF';
		this.deccel = 0;
		this.mfrs = 60;
		this.is_ground = is_ground || false;
		this.size = 30;
		if( is_ground ) {
			this.size = 20;
			this.vy = 0;
		}
	}

	update() {
		super.update();
		if( this.is_ground ) {
			this.y += game.tss;
			if( this.y > dh ) {
				this.remv = true;
			}
		} else {
			if( this.f > this.mfrs ) {
				this.remv = true;
			}
		}
	}

	draw() {
		drawText( this.text, this.x, this.y, this );
	}
}

class Lazer extends Actor {
	constructor( type, is_sound ) {
		super( 'lazer_' + type );
		this.damage = 1;
		this.vy = -10;
		this.vx = 0;
		this.isdel = true; // is delayed, will only display/update as soon as this.f > this.delay
		this.delay = 0;
		this.x_offset = 0;
		this.sprite = 'lazer' + type;
		this.expl = 'expl_lazer';

		// if all lazers had sound, the game would run out of channels rly fast (there's a lot of lazers on the screen at once)
		this.sound = is_sound;
	}

	update() {
		this.f++;
		if( this.isdel && this.f > this.delay ) {
			const { x, y } = game.player;
			this.isdel = false;
			this.x = x + this.x_offset;
			this.y = y;
			if( this.sound ) {
				playSound( 'lz' );
			}
		}
		this.y += this.vy;
		this.x += this.vx;
		for( let i = 0; i < game.actors.length; i++ ) {
			let act = game.actors[ i ];
			if( act instanceof Air ) {
				let collision = this.coll( act );
				if( collision ) {
					this.explode();
					act.damage( this.damage );
					break;
				}
			}
		}

		if( this.f > 60 * 3 ) {
			this.remv = true;
		}
	}

	draw() {
		if( !this.isdel ) {
			super.draw();
		}
	}
}

// This is almost exactly the same as the lazer class, but can send bullets an arbitrary
// direction, instead of just up.
class Bullet extends Actor {
	constructor( type, hed ) {
		super( 'bullet_' + type );
		this.sprite = 'bullet' + type;
		this.hed = hed;
		this.mxsd = 4;
		this.accel = 1;
		this.r = 6;
		let { x, y } = display.hedToVec( hed, this.mxsd );
		this.vx = x;
		this.vy = y;
		this.dmg = 1;
		this.ai = () => {
			if( this.f > 120 ) {
				this.remv = true;
			}
		};
	}

	update() {
		this.f++;
		this.ai();
		this.x += this.vx;
		this.y += this.vy;
		let collision = this.coll( game.player );
		if( collision ) {
			playSound( 'hit' );
			game.player.damage( this.dmg );
			this.explode();
		}
	}
}

class Bomb extends Actor {
	constructor( type, x, y, ty ) {
		super( 'bomb_' + type );
		this.x = x;
		this.sy = y - 20;
		this.y = y;
		this.tgy = ty; //target y
		this.sprite = 'bomb' + type;
		this.mfrs = 40; //move frames
		this.r = 7;
		this.expl = 'expl_bomb';
	}

	explode() {
		this.remv = true;
		game.addPar( this.expl, this.x, this.y, true );
	}

	update() {
		this.y = this.sy +
			display.normalize( this.f, 0, this.mfrs, 0, this.tgy ) +
			this.mfrs * game.tss;
		this.f++;
		if( this.f === this.mfrs ) {
			for( let i = 0; i < game.actors.length; i++ ) {
				let act = game.actors[ i ];
				if( ( act instanceof GroundTank || act instanceof GroundCache ) && !act.dead ) {
					let collision = this.coll( act );
					if( collision ) {
						playSound( 'sand' );
						act.damage( 1 );
						break;
					}
				}
			}
			playSound( 'bombg' );
			this.explode();
		}
	}
}

class Harpoon extends Actor {
	constructor( type, x, y ) {
		super( 'harpoon_' + type );
		this.x = x;
		this.y = y;
		this.sprite = 'harpoon';
		this.mfrs = 40;
		this.r = 7;
		this.vy = 5;
		this.expl = 'expl_bomb';
		this.connected = false;
		this.upfrs = 120;
		this.maxdist = 300;
		this.plug = null;
	}

	update() {
		let pl = game.player;
		this.f++;
		this.y += this.vy;
		this.x += this.vx;
		if( this.f === this.mfrs ) {
			if( this.connected ) {
				playSound( 'upl' );
				game.addText( 'Uploaded! (+5000)', '#5E5' );
				this.plug.dead = true;
				game.aPts( 5000 );
				if( pause_name === 61 ) {
					game.go( 0 );
				}
			}
			this.explode();
			return;
		}

		if ( this.connected ) {
			this.y += game.tss;
			let dist = display.distance( this.x, this.y, pl.x, pl.y );
			if( this.f % 20 === 0 ) {
				playSound( 'blip' );
			}

			if( dist > this.maxdist ) {
				playSound( 'uplf' );
				this.explode();
				game.addText( 'Disconnect!', '#E55' );
			}
		} else {
			for( let i = 0; i < game.actors.length; i++ ) {
				let act = game.actors[ i ];
				if( act instanceof Plug && !act.dead ) {
					let collision = this.coll( act );
					if( collision ) {
						game.addText( 'Uploading...' );
						this.connected = true;
						this.vx = this.vy = this.f = 0;
						this.x = act.x;
						this.y = act.y;
						this.mfrs = act.nframes;
						this.plug = act;
						break;
					}
				}
			}
		}
	}

	draw() {
		let { x: plx, y: ply } = game.player;
		display.drawSprite( this.sprite, this.x, this.y );
		let o = { x: this.x, y: this.y, x2: plx, y2: ply, color: '#EEE' };
		display.line( o );
		if( this.connected ) {
			o.x += 3;
			o.color = '#AAF';
			display.line( o );
			o.x -= 6;
			display.line( o );
			if( this.f % 10 < 5 ) {
				display.line( { x: this.x, y: this.y, x2: plx, y2: ply, color: '#333' } );
			}
			display.circle( { x: this.x, y: this.y, r: this.maxdist, color: '#FFF', o:1 } );
		}
	}
}

class Powerup extends Actor {
	constructor( name, x, y, vx, vy ) {
		super( 'pwr' + name );
		this.x = x;
		this.y = y;
		this.vx = vx;
		this.vy = vy;
		this.anim = display.getAnim( 'pwr' + name );
		this.mfrs = 60 * 6;
		this.accel = 0.2;
		this.maxax = 3;
		this.mxsd = 8;
		this.r = 15;
		this.ai = () => {
			let pl = game.player;
			let dist = display.distance( this.x, this.y, pl.x, pl.y );
			if( dist < 100 ) {
				this.pointAt( pl );
				this.acc();
				return;
			}

			if( this.name !== 'pwrcoin' ) {
				this.turn( 'l' );
				if( Math.random() > 0.5 ) {
					this.acc();
				}
			}
		};
	}

	update() {
		super.update();
		if( this.f === this.mfrs ) {
			this.remv = true;
		}
		let collision = this.coll( game.player );
		if( collision ) {
			this.remv = true;
			if( this.name === 'pwrhp' ) {
				game.player.plusHP( 50 );
				playSound( 'hp' );
			}
			if( this.name === 'pwrlazer' ) {
				game.player.lzlvl++;
				if( game.player.lzlvl > 3 ) {
					game.player.lzlvl = 3;
				}
				playSound( 'sp' );
			}
			if( this.name === 'pwrcoin' ) {
				game.aPts( 1000 );
				playSound( 'coin' );
			}
			if( this.name === 'pwr2x' ) {
				game.addText( '2x Points!', '#EE5' );
				game.smult *= 2;
				playSound( 'sp' );
			}
		}
	}

	draw() {
		if( this.f > this.mfrs / 2 ) {
			if( this.f % 8 < 4 ) {
				return;
			}
		}
		let h = this.hed;
		this.hed = 0;
		super.draw();
		this.hed = h;
	}
}

game = {
	keys: {},
	cbs: [],
	cbs_pll: [],

	// commented these out to save space because they are redefined in 'start', and are not
	// necessary for initialization
	// actors: [],
	// paused: false,
	// player: null,
	// level: null,
	// lvln: 1,
	// level_frame: 0,
	// scrolling: true,
	// tyoff: 0,
	// tss: TSS,
	// spawns: [],
	// spawn_frame: 0,
	// fopac: 1.0,
	// ncontrol: false,
	// started: false,
	// loading: false,
	// hs: false,
	// vic: false,

	high_score: ( ls && ls.getItem( 'score' ) ) || 0,
	score: 0,
	smult: 1,

	init() {
		dh = display.height;
		dw = display.width;
		game.paused = true;
		game.setEvents();
		display.clearScreen();
		display.setLoop( game.loop );
	},

	// Start the game, resetting all variables except for the high score
	start() {
		playSound( 'lvls' );
		game.loading = true;

		// the game noticibly lags while setting the terrain, so this makes it look like a loading
		// black screen for 100 ms whenever it is loaded
		setTimeout( () => {
			pause_name = '';

			//I think this maybe saved like 8 bytes over just saying game.loading, game.started... etc
			Object.assign( game, {
				loading: 0,
				started: 1,
				paused: 0,
				scrolling: 1,
				lvln: 1,
				actors: [],
				spawns: [],
				player: new Player(),
				score: 0,
				smult: 1,
				spawn_frame: 0,
				tss: TSS,
				i: null
			} );
			game.createObjects();
			game.camToLvl( game.lvln );
			game.fade( true );
		}, 100 );
	},

	// Move the "camera" (the terrain offset) to the position at the start of the level number given
	camToLvl( lvln ) {
		let c = game.actors.reduce( ( prev, c ) => {
			if( prev ) {
				return prev;
			} else if( c instanceof GameControl && c.begin_level === lvln+'' ) {
				return c;
			} else {
				return null;
			}
		}, null );
		game.tyoff = c.y * 32;

		// for testing that the end game victory screen works
		//game.tyoff = 24500;
	},

	// the "GameOver" function, if vic is true, then the player completed the entire game.
	end( vic ) {
		game.cbs = [];
		game.cbs_pll = [];
		game.ncontrol = true;
		let v = 50;
		let r = Math.random;
		let p = game.player;
		if( vic ) {
			playSound( 'lvlc' );
			game.actors.forEach( ( a ) => {
				a instanceof GroundTank && a.explode();
			} );
			game.vic = true;
			game.setCB( function(){}, 60 );
		} else {
			for( let i = 0; i < 8; i++ ) {
				game.addPar( 'expl_air', p.x - v / 2 + r() * v, p.y - v / 2 + r() * v );
			}
		}
		game.fade( false );
		if( game.score > game.high_score ) {
			playSound( 'upl' );
			game.high_score = game.score;
			ls && ls.setItem( 'score', game.score );
			game.hs = true;
		}
		game.setCB( () => {
			game.hs = false;
			game.ncontrol = false;
			game.started = false;
			game.vic = false;
		}, 60 );
	},

	// called when a level is over, also calls the end game function if it is the last level
	endLevel() {
		game.tss = 0;
		const sp = 10;
		for( let i = 0; i < 5; i++ ) {
			game.setCB( () => {
				playSound( 'lvlc' );
			}, sp );
		}
		game.fade( false );
		if( game.lvln === 3 ) {
			game.end( true );
			return;
		}
		game.setCB( () => {
			game.lvln++;
			game.fade( true );
			game.camToLvl( game.lvln );
			game.tss = TSS;
			playSound( 'lvls' );
		}, 5 * 60 );
	},

	// fade(true) fades from black screen to game, fade(false) fades from game to black screen
	fade( o ) {
		for( let i = 0; i < 10; i++ ) {
			if( o ) {
				game.fopac = 1;
			}
			game.setCB( () => {
				if( o ) {
					game.fopac = Number( ( ( 9 - i ) / 9 ).toFixed( 1 ) );
				} else {
					game.fopac = Number( ( i / 9 ).toFixed( 1 ) );
				}
			}, 8 );
		}
	},

	// the main game loop
	loop() {
		if( game.paused ) {
			display.clearScreen();
			game.draw();
			return;
		}

		if( !game.ncontrol || ( game.ncontrol && display.frame % 3 === 0 ) ) {
			game.update();
			display.clearScreen();
			game.draw();
			return;
		}
	},
	update() {
		if( this.cbs.length ) {
			let cb_obj = this.cbs[ 0 ];
			cb_obj.current_frame++;
			if( cb_obj.current_frame >= cb_obj.mfrs ) {
				cb_obj.cb();
				this.cbs.shift();
			}
		}
		this.cbs_pll = this.cbs_pll.filter( ( cb_obj ) => {
			cb_obj.current_frame++;
			if( cb_obj.current_frame >= cb_obj.mfrs ) {
				cb_obj.cb();
				return false;
			}
			return true;
		} );

		if( !game.started ) {
			return;
		}
		game.player.update();
		for( let i = 0; i < game.actors.length; i++ ) {
			let act = game.actors[ i ];
			act.update();
			if( act.remv ) {
				game.actors.splice( i, 1 );
				i--;
			}
		}

		game.spawn();

		if( game.scrolling ) {
			game.tyoff += game.tss;
			if( game.tyoff > terrain.height - dh ) {
				game.tyoff = terrain.height - dh;
			}
		}
	},
	draw() {
		if( game.loading ) {
			return;
		}
		if( !game.started ) {
			let t = 'High Score ' + game.high_score;
			drawText( t, 50, 50, { size: 25, color: 'gold' } );
			drawText( 'PLANET: OFFLINE', 222, 400, { size: 42 } );
			drawText( 'Press any key...', 288, 600, { size: 28 } );
			return;
		}

		terrain.draw( game.tyoff );
		for( let i = 0; i < game.actors.length; i++ ) {
			let act = game.actors[ i ];
			act.draw();
		}

		if( game.fopac ) {
			display.rect( { x: 400, y: 400, w: 800, h: 800, color: black( game.fopac ) } );
		}
		if( game.hs ) {
			drawText( 'NEW HIGH SCORE!', 220, 120 + Math.random() * 3, { size: 42, c: 'cyan' } );
		}
		if( game.vic ) {
			drawText( 'VICTORY!', 307, 220 + Math.random() * 3, { size: 42, c: 'green' } );
		}
		if( !game.ncontrol ) {
			game.player.draw();
		}

		drawText( 'ESC to pause, "m" to mute', 20, 20, { size: 16 } );
		drawText( 'SCORE: ' + game.score + ' x' + game.smult, dw - 260, 20, { size: 16 } );

		if( game.paused ) {
			display.rect( { x: 400, y: 400, w: 800, h: 800, c: black( 0.3 ) } );
			drawText( 'PAUSED', 356, 400, { size: 28 } );
			drawText( 'ESC to unpause', 341, 450, { size: 16 } );
		}
	},
	spawn() {
		if( game.spawns.length === 0 ) {
			game.spawn_frame = 0;
			return;
		}
		if( game.spawn_frame >= 10 ) {
			let spawn_str = game.spawns.shift();
			let location = spawn_str.split( ',' )[ 0 ];
			let name = spawn_str.split( ',' )[ 1 ];
			let air = new Air( name );
			air.y = -20;
			air.vy = 2;
			air.hed = 180;
			let a = dw / 2 - 100;
			let b = dw / 2 + 100;
			if( location === 'l' ) {
				a = 25;
				b = 226;
			} else if( location === 'r' ) {
				a = dw - 225;
				b = dw - 25;
			} else if( location === 'a' ) {
				a = 50;
				b = 750;
			}
			air.x = display.randbtwn( a, b );
			game.actors.push( air );
			game.spawn_frame = 0;
		} else {
			game.spawn_frame++;
		}
	},
	setCB( cb, n, is_pll ) {
		( is_pll ? this.cbs_pll : this.cbs ).push( {
			cb,
			mfrs: n,
			current_frame: 0
		} );
	},
	addPar( anim_name, x, y, is_ground ) {
		let p = new ( is_ground ? ParticleGround : Particle )( anim_name, x, y );
		game.actors.push( p );
		return p;
	},
	addText( text, color ) {
		color = color || '#FFF';
		let p = new TextParticle( text, dw / 2 - text.length * 7, 90 );
		p.color = color;
		game.actors.push( p );
		return p;
	},
	addPowerup( name, x, y, vx, vy ) {
		let p = new Powerup( name, x, y, vx, vy );
		this.actors.push( p );
	},
	aPts( p ) {
		game.score += p * game.smult;
	},

	// Stupid hack to make the first pause screen move forward when both the uplink has been
	// uploaded, and the cache destroyed on the opening screen.  Players were having trouble
	// reading the text fast enough and getting confused so I made it mandatory for them
	// to at least accomplish something before even starting the game.
	go( i ) {
		if( ( this.i === 1 && i === 0 ) || ( this.i === 0 && i === 1 ) ) {
			game.tss = TSS;
		}
		this.i = i;
	},

	// Set the initial game state, including generating the map and adding all the spawns.
	// Lags game, especially on lower end computers.
	createObjects() {
		game.level_frame = 0;
		let l = window.app.level.split( '|' ).map( ( a ) => {
			return a.split( ',' );
		} );
		terrain.set();
		let obj = {
			w: ( arr ) => { //wait
				let s = new GameControl( pInt( arr[ 1 ] ) );
				s.loc = arr[ 5 ];
				s.wait = arr[ 2 ];
				s.type = arr[ 6 ];
				s.level = arr[ 7 ];
				s.amt = arr[ 8 ];
				game.actors.push( s );
			},
			u: ( arr ) => { //uplink
				game.actors.push( new Plug( 'plug', pInt( arr[ 1 ] ), pInt( arr[ 2 ] ) , arr[ 3 ] ) );
			},
			c: ( arr ) => { //cache
				//game.actors.push( new GroundCache( ...arr.slice( 1 ) ) );
				game.actors.push( new GroundCache( arr[ 1 ], arr[ 2 ], arr[ 3 ], arr[ 4 ] ) );
			},
			p: ( arr ) => { //pause
				let s = new GameControl( pInt( arr[ 1 ] ) );
				s.pause_seconds = pInt( arr[ 2 ] );
				game.actors.push( s );
			},
			s: ( arr ) => { //spawn
				// [ "s", 32, "c", "a", 1, "12" ]
				let s = new GameControl( pInt( arr[ 1 ] ) );
				s.loc = arr[ 2 ];
				s.type = arr[ 3 ];
				s.level = arr[ 4 ];
				s.amt = arr[ 5 ];
				game.actors.push( s );
			},
			g: ( arr ) => { //ground
				game.actors.push( new GroundTank( 'ground' + arr[ 3 ], arr[ 1 ], arr[ 2 ] ) );
			},
			t: ( arr ) => { //text particle, permanent
				game.actors.push( new TextParticle( arr[ 3 ], arr[ 1 ] * 25, arr[ 2 ] * 32, true ) );
			},
			bl: ( arr ) => { //begin level
				let s = new GameControl( pInt( arr[ 1 ] ) );
				s.begin_level = arr[ 2 ];
				s.amt = 0;
				s.y = pInt( arr[ 1 ] );
				s.x = 0;
				game.actors.push( s );
			},
			sl: ( arr ) => { //end level
				let s = new GameControl( pInt( arr[ 1 ] ) );
				s.end_level = arr[ 2 ];
				game.actors.push( s );
			}
		};

		l.forEach( ( arr ) => {
			obj[ arr[ 0 ] ]( arr );
		} );
	},
	setEvents(){
		document.addEventListener( 'keydown', ( ev ) => {
			let k = ev.key.toLowerCase();
			if( game.ncontrol ) {
				return;
			}
			if( game.keys[ k ] ) {
				return;
			}
			game.keys[ k ] = true;

			if( !game.started ) {
				game.start();
				return;
			}

			if( k === 'm' ) {
				display.mute = !display.mute;
			}
			if( k === 'escape' ) {
				game.paused = !game.paused;
			}
			if( game.paused ) {
				return;
			}
			if( k === 'arrowleft' ) {
				game.player.setState( 'left' );
			}
			if( k === 'arrowright' ) {
				game.player.setState( 'right' );
			}
			if( k === 'z' ) {
				game.player.lazer();
			}
			if( k === 'x' ) {
				game.player.bomb();
			}
			if( k === 'c' ) {
				game.player.harpoon();
			}
		} );

		document.addEventListener( 'keyup', ( ev ) => {
			game.keys[ ev.key.toLowerCase() ] = false;
		} );
	}
};

window.app.game = game;
game.Actor = Actor;
game.Bullet = Bullet;
game.Bomb = Bomb;
game.Lazer = Lazer;
game.Harpoon = Harpoon;

} )();
