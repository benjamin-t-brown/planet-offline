( function(){
/**
 * SfxrParams
 *
 * Copyright 2010 Thomas Vian
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Thomas Vian
 */
/** @constructor */
function SfxrParams() {
  //--------------------------------------------------------------------------
  //
  //  Settings String Methods
  //
  //--------------------------------------------------------------------------

  /**
   * Parses a settings array into the parameters
   * @param array Array of the settings values, where elements 0 - 23 are
   *                a: waveType
   *                b: attackTime
   *                c: sustainTime
   *                d: sustainPunch
   *                e: decayTime
   *                f: startFrequency
   *                g: minFrequency
   *                h: slide
   *                i: deltaSlide
   *                j: vibratoDepth
   *                k: vibratoSpeed
   *                l: changeAmount
   *                m: changeSpeed
   *                n: squareDuty
   *                o: dutySweep
   *                p: repeatSpeed
   *                q: phaserOffset
   *                r: phaserSweep
   *                s: lpFilterCutoff
   *                t: lpFilterCutoffSweep
   *                u: lpFilterResonance
   *                v: hpFilterCutoff
   *                w: hpFilterCutoffSweep
   *                x: masterVolume
   * @return If the string successfully parsed
   */
  this.setSettings = function(values)
  {
    for ( var i = 0; i < 24; i++ )
    {
      this[String.fromCharCode( 97 + i )] = values[i] || 0;
    }

    // I moved this here from the reset(true) function
    if (this['c'] < .01) {
      this['c'] = .01;
    }

    var totalTime = this['b'] + this['c'] + this['e'];
    if (totalTime < .18) {
      var multiplier = .18 / totalTime;
      this['b']  *= multiplier;
      this['c'] *= multiplier;
      this['e']   *= multiplier;
    }
  }
}

/**
 * SfxrSynth
 *
 * Copyright 2010 Thomas Vian
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Thomas Vian
 */
/** @constructor */
function SfxrSynth() {
  // All variables are kept alive through function closures

  //--------------------------------------------------------------------------
  //
  //  Sound Parameters
  //
  //--------------------------------------------------------------------------

  this._params = new SfxrParams();  // Params instance

  //--------------------------------------------------------------------------
  //
  //  Synth Variables
  //
  //--------------------------------------------------------------------------

  var _envelopeLength0, // Length of the attack stage
      _envelopeLength1, // Length of the sustain stage
      _envelopeLength2, // Length of the decay stage

      _period,          // Period of the wave
      _maxPeriod,       // Maximum period before sound stops (from minFrequency)

      _slide,           // Note slide
      _deltaSlide,      // Change in slide

      _changeAmount,    // Amount to change the note by
      _changeTime,      // Counter for the note change
      _changeLimit,     // Once the time reaches this limit, the note changes

      _squareDuty,      // Offset of center switching point in the square wave
      _dutySweep;       // Amount to change the duty by

  //--------------------------------------------------------------------------
  //
  //  Synth Methods
  //
  //--------------------------------------------------------------------------

  /**
   * Resets the runing variables from the params
   * Used once at the start (total reset) and for the repeat effect (partial reset)
   */
  this.reset = function() {
    // Shorter reference
    var p = this._params;

    _period       = 100 / (p['f'] * p['f'] + .001);
    _maxPeriod    = 100 / (p['g']   * p['g']   + .001);

    _slide        = 1 - p['h'] * p['h'] * p['h'] * .01;
    _deltaSlide   = -p['i'] * p['i'] * p['i'] * .000001;

    if (!p['a']) {
      _squareDuty = .5 - p['n'] / 2;
      _dutySweep  = -p['o'] * .00005;
    }

    _changeAmount =  1 + p['l'] * p['l'] * (p['l'] > 0 ? -.9 : 10);
    _changeTime   = 0;
    _changeLimit  = p['m'] == 1 ? 0 : (1 - p['m']) * (1 - p['m']) * 20000 + 32;
  }

  // I split the reset() function into two functions for better readability
  this.totalReset = function() {
    this.reset();

    // Shorter reference
    var p = this._params;

    // Calculating the length is all that remained here, everything else moved somewhere
    _envelopeLength0 = p['b']  * p['b']  * 100000;
    _envelopeLength1 = p['c'] * p['c'] * 100000;
    _envelopeLength2 = p['e']   * p['e']   * 100000 + 12;
    // Full length of the volume envelop (and therefore sound)
    // Make sure the length can be divided by 3 so we will not need the padding "==" after base64 encode
    return ((_envelopeLength0 + _envelopeLength1 + _envelopeLength2) / 3 | 0) * 3;
  }

  /**
   * Writes the wave to the supplied buffer ByteArray
   * @param buffer A ByteArray to write the wave to
   * @return If the wave is finished
   */
  this.synthWave = function(buffer, length) {
    // Shorter reference
    var p = this._params;

    // If the filters are active
    var _filters = p['s'] != 1 || p['v'],
        // Cutoff multiplier which adjusts the amount the wave position can move
        _hpFilterCutoff = p['v'] * p['v'] * .1,
        // Speed of the high-pass cutoff multiplier
        _hpFilterDeltaCutoff = 1 + p['w'] * .0003,
        // Cutoff multiplier which adjusts the amount the wave position can move
        _lpFilterCutoff = p['s'] * p['s'] * p['s'] * .1,
        // Speed of the low-pass cutoff multiplier
        _lpFilterDeltaCutoff = 1 + p['t'] * .0001,
        // If the low pass filter is active
        _lpFilterOn = p['s'] != 1,
        // masterVolume * masterVolume (for quick calculations)
        _masterVolume = p['x'] * p['x'],
        // Minimum frequency before stopping
        _minFreqency = p['g'],
        // If the phaser is active
        _phaser = p['q'] || p['r'],
        // Change in phase offset
        _phaserDeltaOffset = p['r'] * p['r'] * p['r'] * .2,
        // Phase offset for phaser effect
        _phaserOffset = p['q'] * p['q'] * (p['q'] < 0 ? -1020 : 1020),
        // Once the time reaches this limit, some of the    iables are reset
        _repeatLimit = p['p'] ? ((1 - p['p']) * (1 - p['p']) * 20000 | 0) + 32 : 0,
        // The punch factor (louder at begining of sustain)
        _sustainPunch = p['d'],
        // Amount to change the period of the wave by at the peak of the vibrato wave
        _vibratoAmplitude = p['j'] / 2,
        // Speed at which the vibrato phase moves
        _vibratoSpeed = p['k'] * p['k'] * .01,
        // The type of wave to generate
        _waveType = p['a'];

    var _envelopeLength      = _envelopeLength0,     // Length of the current envelope stage
        _envelopeOverLength0 = 1 / _envelopeLength0, // (for quick calculations)
        _envelopeOverLength1 = 1 / _envelopeLength1, // (for quick calculations)
        _envelopeOverLength2 = 1 / _envelopeLength2; // (for quick calculations)

    // Damping muliplier which restricts how fast the wave position can move
    var _lpFilterDamping = 5 / (1 + p['u'] * p['u'] * 20) * (.01 + _lpFilterCutoff);
    if (_lpFilterDamping > .8) {
      _lpFilterDamping = .8;
    }
    _lpFilterDamping = 1 - _lpFilterDamping;

    var _finished = false,     // If the sound has finished
        _envelopeStage    = 0, // Current stage of the envelope (attack, sustain, decay, end)
        _envelopeTime     = 0, // Current time through current enelope stage
        _envelopeVolume   = 0, // Current volume of the envelope
        _hpFilterPos      = 0, // Adjusted wave position after high-pass filter
        _lpFilterDeltaPos = 0, // Change in low-pass wave position, as allowed by the cutoff and damping
        _lpFilterOldPos,       // Previous low-pass wave position
        _lpFilterPos      = 0, // Adjusted wave position after low-pass filter
        _periodTemp,           // Period modified by vibrato
        _phase            = 0, // Phase through the wave
        _phaserInt,            // Integer phaser offset, for bit maths
        _phaserPos        = 0, // Position through the phaser buffer
        _pos,                  // Phase expresed as a Number from 0-1, used for fast sin approx
        _repeatTime       = 0, // Counter for the repeats
        _sample,               // Sub-sample calculated 8 times per actual sample, averaged out to get the super sample
        _superSample,          // Actual sample writen to the wave
        _vibratoPhase     = 0; // Phase through the vibrato sine wave

    // Buffer of wave values used to create the out of phase second wave
    var _phaserBuffer = new Array(1024),
        // Buffer of random values used to generate noise
        _noiseBuffer  = new Array(32);
    for (var i = _phaserBuffer.length; i--; ) {
      _phaserBuffer[i] = 0;
    }
    for (var i = _noiseBuffer.length; i--; ) {
      _noiseBuffer[i] = Math.random() * 2 - 1;
    }

    for (var i = 0; i < length; i++) {
      if (_finished) {
        return i;
      }

      // Repeats every _repeatLimit times, partially resetting the sound parameters
      if (_repeatLimit) {
        if (++_repeatTime >= _repeatLimit) {
          _repeatTime = 0;
          this.reset();
        }
      }

      // If _changeLimit is reached, shifts the pitch
      if (_changeLimit) {
        if (++_changeTime >= _changeLimit) {
          _changeLimit = 0;
          _period *= _changeAmount;
        }
      }

      // Acccelerate and apply slide
      _slide += _deltaSlide;
      _period *= _slide;

      // Checks for frequency getting too low, and stops the sound if a minFrequency was set
      if (_period > _maxPeriod) {
        _period = _maxPeriod;
        if (_minFreqency > 0) {
          _finished = true;
        }
      }

      _periodTemp = _period;

      // Applies the vibrato effect
      if (_vibratoAmplitude > 0) {
        _vibratoPhase += _vibratoSpeed;
        _periodTemp *= 1 + Math.sin(_vibratoPhase) * _vibratoAmplitude;
      }

      _periodTemp |= 0;
      if (_periodTemp < 8) {
        _periodTemp = 8;
      }

      // Sweeps the square duty
      if (!_waveType) {
        _squareDuty += _dutySweep;
        if (_squareDuty < 0) {
          _squareDuty = 0;
        } else if (_squareDuty > .5) {
          _squareDuty = .5;
        }
      }

      // Moves through the different stages of the volume envelope
      if (++_envelopeTime > _envelopeLength) {
        _envelopeTime = 0;

        switch (++_envelopeStage)  {
          case 1:
            _envelopeLength = _envelopeLength1;
            break;
          case 2:
            _envelopeLength = _envelopeLength2;
        }
      }

      // Sets the volume based on the position in the envelope
      switch (_envelopeStage) {
        case 0:
          _envelopeVolume = _envelopeTime * _envelopeOverLength0;
          break;
        case 1:
          _envelopeVolume = 1 + (1 - _envelopeTime * _envelopeOverLength1) * 2 * _sustainPunch;
          break;
        case 2:
          _envelopeVolume = 1 - _envelopeTime * _envelopeOverLength2;
          break;
        case 3:
          _envelopeVolume = 0;
          _finished = true;
      }

      // Moves the phaser offset
      if (_phaser) {
        _phaserOffset += _phaserDeltaOffset;
        _phaserInt = _phaserOffset | 0;
        if (_phaserInt < 0) {
          _phaserInt = -_phaserInt;
        } else if (_phaserInt > 1023) {
          _phaserInt = 1023;
        }
      }

      // Moves the high-pass filter cutoff
      if (_filters && _hpFilterDeltaCutoff) {
        _hpFilterCutoff *= _hpFilterDeltaCutoff;
        if (_hpFilterCutoff < .00001) {
          _hpFilterCutoff = .00001;
        } else if (_hpFilterCutoff > .1) {
          _hpFilterCutoff = .1;
        }
      }

      _superSample = 0;
      for (var j = 8; j--; ) {
        // Cycles through the period
        _phase++;
        if (_phase >= _periodTemp) {
          _phase %= _periodTemp;

          // Generates new random noise for this period
          if (_waveType == 3) {
            for (var n = _noiseBuffer.length; n--; ) {
              _noiseBuffer[n] = Math.random() * 2 - 1;
            }
          }
        }

        // Gets the sample from the oscillator
        switch (_waveType) {
          case 0: // Square wave
            _sample = ((_phase / _periodTemp) < _squareDuty) ? .5 : -.5;
            break;
          case 1: // Saw wave
            _sample = 1 - _phase / _periodTemp * 2;
            break;
          case 2: // Sine wave (fast and accurate approx)
            _pos = _phase / _periodTemp;
            _pos = (_pos > .5 ? _pos - 1 : _pos) * 6.28318531;
            _sample = 1.27323954 * _pos + .405284735 * _pos * _pos * (_pos < 0 ? 1 : -1);
            _sample = .225 * ((_sample < 0 ? -1 : 1) * _sample * _sample  - _sample) + _sample;
            break;
          case 3: // Noise
            _sample = _noiseBuffer[Math.abs(_phase * 32 / _periodTemp | 0)];
        }

        // Applies the low and high pass filters
        if (_filters) {
          _lpFilterOldPos = _lpFilterPos;
          _lpFilterCutoff *= _lpFilterDeltaCutoff;
          if (_lpFilterCutoff < 0) {
            _lpFilterCutoff = 0;
          } else if (_lpFilterCutoff > .1) {
            _lpFilterCutoff = .1;
          }

          if (_lpFilterOn) {
            _lpFilterDeltaPos += (_sample - _lpFilterPos) * _lpFilterCutoff;
            _lpFilterDeltaPos *= _lpFilterDamping;
          } else {
            _lpFilterPos = _sample;
            _lpFilterDeltaPos = 0;
          }

          _lpFilterPos += _lpFilterDeltaPos;

          _hpFilterPos += _lpFilterPos - _lpFilterOldPos;
          _hpFilterPos *= 1 - _hpFilterCutoff;
          _sample = _hpFilterPos;
        }

        // Applies the phaser effect
        if (_phaser) {
          _phaserBuffer[_phaserPos % 1024] = _sample;
          _sample += _phaserBuffer[(_phaserPos - _phaserInt + 1024) % 1024];
          _phaserPos++;
        }

        _superSample += _sample;
      }

      // Averages out the super samples and applies volumes
      _superSample *= .125 * _envelopeVolume * _masterVolume;

      // Clipping if too loud
      buffer[i] = _superSample >= 1 ? 32767 : _superSample <= -1 ? -32768 : _superSample * 32767 | 0;
    }

    return length;
  }
}

// Adapted from http://codebase.es/riffwave/
var synth = new SfxrSynth();
// Export for the Closure Compiler
var jsfxr = function(settings) {
  // Initialize SfxrParams
  synth._params.setSettings(settings);
  // Synthesize Wave
  var envelopeFullLength = synth.totalReset();
  var data = new Uint8Array(((envelopeFullLength + 1) / 2 | 0) * 4 + 44);
  var used = synth.synthWave(new Uint16Array(data.buffer, 44), envelopeFullLength) * 2;
  var dv = new Uint32Array(data.buffer, 0, 44);
  // Initialize header
  dv[0] = 0x46464952; // "RIFF"
  dv[1] = used + 36;  // put total size here
  dv[2] = 0x45564157; // "WAVE"
  dv[3] = 0x20746D66; // "fmt "
  dv[4] = 0x00000010; // size of the following
  dv[5] = 0x00010001; // Mono: 1 channel, PCM format
  dv[6] = 0x0000AC44; // 44,100 samples per second
  dv[7] = 0x00015888; // byte rate: two bytes per sample
  dv[8] = 0x00100002; // 16 bits per sample, aligned on every two bytes
  dv[9] = 0x61746164; // "data"
  dv[10] = used;      // put number of samples here

  // Base64 encoding written by me, @maettig
  used += 44;
  var i = 0,
      base64Characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
      output = 'data:audio/wav;base64,';
  for (; i < used; i += 3)
  {
    var a = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
    output += base64Characters[a >> 18] + base64Characters[a >> 12 & 63] + base64Characters[a >> 6 & 63] + base64Characters[a & 63];
  }
  return output;
}

if (typeof require === 'function') {
  module.exports = jsfxr;
}
else {
  this.jsfxr = jsfxr;
}

})();

( function() {

	let display = {
		canvas_id: 'c',
		canvas: null,
		ctx: null,
		sprites: {},
		frame: 0,
		width: window.innerWidth,
		height: window.innerHeight,
		mute: false,
		sounds: [],
		animations: {},
		transform: {
			x: 0,
			y: 0
		}
	};

	class Animation {
		constructor( name, loop ) {
			this.name = name;
			this.loop = loop || false;
			this.sprites = [];

			this.cf = 0;
			this.cf_max = 0;
			this.cind = 0;
			this.is_done = false;
		}

		s( name, nframes ) {
			this.sprites.push( {
				max_frames: nframes,
				name: name
			} );
			if ( this.sprites.length === 1 ) {
				this.cf_max = nframes;
			}
		}

		update() {
			this.cf++;
			if ( this.cf >= this.cf_max ) {
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
				this.cf_max = this.sprites[ this.cind ].max_frames;
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
		display.canvas_id = display.canvas_id;
		display.canvas = document.getElementById( display.canvas_id );
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
		display.preDrawSprite( spr );
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
		// 		let channels = [ a ];
		// 		for( let i = 0; i < 3; i++ ) {
		// 			channels.push( a.cloneNode( true ) );
		// 		}
		// 		display.sounds[ name ] = {
		// 			cc: 0,
		// 			channels
		// 		};
		// 	} );
		// };
		let jsfxr = window.jsfxr;
		let loadSound = ( name, args ) => {
			let url = jsfxr( args );
			let channels = [];
			for ( let i = 0; i < 4; i++ ) {
				let s = new Audio();
				s.src = url;
				channels.push( s );
			}
			display.sounds[ name ] = {
				cc: 0,
				channels
			};
		};

		loadSound( 'sand', [ 3, 0.13, 0.26, 0.95, 0.35, 0.37, , 0.5, , 0.19, 0.37, 0.8799, 0.35, , , , , , 1, -0.92, 0.12, 0.1614, , 0.25 ] );
		loadSound( 'bomb', [ 0, 0.13, 0.26, 0.53, 0.35, 0.04, , 0.5, , 0.19, 0.37, 0.1799, 0.35, , , 0.56, -0.86, 0.76, 1, 0.56, 0.68, 0.78, -0.4599, 0.25 ] );
		loadSound( 'coin', [ 0, , 0.0917, 0.37, 0.32, 0.54, , , , 0.23, 0.02, 0.4813, 0.65, , , , 0.8, , 1, , 0.11, , , 0.25 ] );
		loadSound( 'expa', [ 3, , 0.1083, 0.3869, 0.3314, 0.1406, , -0.2676, , , , , , , , , 0.5116, -0.2477, 1, , , , , 0.25 ] );
		loadSound( 'expg', [ 3,,0.3646,0.7897,0.2321,0.1281,,-0.3439,,,,,,,,,0.2502,-0.0041,1,,,,,0.25 ] );
		loadSound( 'bombg', [ 3, , 0.01, 0.6031, 0.4332, 0.027, , 0.2071, , , , , , , , , , , 1, , , , , 0.25 ] );
		loadSound( 'bullet', [ 1, 0.0054, 0.2302, , 0.2346, 0.9064, 0.1659, -0.6154, 0.0044, 0.0708, 0.0179, 0.0085, 0.066, 0.5, -0.5604, 0.0104, 0.0832, -0.0182, 0.9625, 0.0138, 0.1126, 0.088, 0.0132, 0.25 ] );
		loadSound( 'lazer1', [ 2, 0.0054, 0.2302, , 0.2346, 0.76, , -0.6154, 0.0044, 0.0708, 0.0179, 0.0085, 0.066, 0.5, -0.5604, 0.0104, 0.0832, -0.0182, 0.9625, 0.0138, 0.1126, 0.088, 0.0132, 0.25 ] );
		loadSound( 'upl', [ 0, , 0.26, , 0.8, 0.45, , 0.305, , , , , , 0.5555, , 0.6, , , 1, , , , , 0.25 ] );
		loadSound( 'hp', [ 0, , 0.2084, , 0.2832, 0.5027, , -0.48, 0.6599, , , , , 0.316, , , , , 0.5663, , , , , 0.5 ] );
		loadSound( 'blip', [ 1, , 0.1086, , 0.1316, 0.2639, , , , , , , , , , , , , 1, , , 0.1, , 0.25 ] );
		loadSound( 'harpoon', [ 3, , 0.1128, 0.95, 0.51, 0.4741, , -0.287, , , , , , , , 0.3824, 0.5549, -0.2718, 1, , , , , 0.25 ] );
		loadSound( 'uplf', [ 1, , 0.57, 0.1, 0.0482, 0.16, , , 0.02, 0.11, 0.32, , , , , , , , 1, , , 0.1, , 0.25 ] );
		loadSound( 'lvlfail', [ 0, , 0.52, 0.25, 1, 0.27, , , , 0.47, 0.12, 0.1999, 0.14, 0.3, 0.6399, 0.552, , , 1, , 0.13, , , 0.25 ] );
		loadSound( 'lvlcomplete', [ 0, 0.04, 0.23, 0.19, 0.59, 0.24, , , , , , , , 0.5161, , , , , 1, , , 0.1, , 0.25 ] );
		loadSound( 'hit', [ 3, , 0.0887, , 0.1681, 0.6516, , -0.4825, , , , , , , , , , , 1, , , 0.129, , 0.25 ] );
		loadSound( 'special', [ 1, , 0.34, , 0.67, 0.16, , 0.4536, , , , -0.24, , , , 0.4182, , , 0.39, , , , , 0.25 ] );
		loadSound( 'lvlstart', [ 3, 0.28, 0.31, 0.08, 0.7, 0.0081, , 0.4503, 0.0324, 0.8, 0.3, 0.62, 0.25, 0.3357, 0.1636, -0.9992, 0.06, 0.24, 0.9625, , -0.7401, , 0.0036, 0.30 ] );
	};

	display.playSound = function( name ) {
		if ( display.mute ) {
			return;
		}
		let s = display.sounds[ name ];
		let ind = ( s && s.cc++ % s.channels.length );
		s.channels[ ind ].play();
	};

	display.setError = function( txt ) {
		console.error( txt );
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
			console.error( 'No animation named: ', k );
			display.setError();
			return null;
		}
	};

	display.preDrawSprite = function( spr ) {
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
		let { font, size, color } = params || {};
		ctx.font = ( size || 16 ) + 'px ' + ( font || 'monospace' );
		ctx.fillStyle = color || 'white';
		ctx.fillText( text, x, y );
	};

	display.drawAnim = function( anim, x, y, scale, rot ) {
		let sprite_name = anim.getSprite();
		display.drawSprite( sprite_name, x, y, scale, rot );
		anim.update();
	};

	display.drawAnimation = display.drawAnim;

	display.init = function( canvas_id, cb ) {
		if ( canvas_id ) {
			display.canvas_id = canvas_id;
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
		display.cAnim( 'player_default', () => {
			let a = new Animation( '', false );
			a.s( 'p2', player_fs );
			return a;
		} );
		display.cAnim( 'player_from_left', () => {
			let a = new Animation( '', false );
			a.s( 'p1', player_fs );
			a.s( 'p2', player_fs );
			return a;
		} );
		display.cAnim( 'player_from_right', () => {
			let a = new Animation( '', false );
			a.s( 'p3', player_fs );
			a.s( 'p2', player_fs );
			return a;
		} );
		display.cAnim( 'player_left', () => {
			let a = new Animation( '', false );
			a.s( 'p1', player_fs );
			a.s( 'p0', player_fs );
			return a;
		} );
		display.cAnim( 'player_right', () => {
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

( function() {
window.app.level = "sl,275,1|sl,533,2|sl,800,3|bl,1,1|bl,279,2|bl,538,3|p,80,15|s,38,c,a,1,15|u,10,57,4|u,15,41,4|c,27,73,5,2x|g,10,65,1|g,9,41,1|g,24,81,1|g,3,94,1|c,15,105,5,coin5|c,29,107,5,coin2|u,7,114,2|u,15,126,2|g,15,116,1|g,7,125,1|g,28,123,1|c,19,144,10,hp|u,4,173,2|u,13,178,4|g,25,185,1|g,3,208,1|g,12,214,1|g,10,226,1|p,257,20|u,5,241,2|u,28,243,2|g,11,246,2|g,29,240,1|c,20,249,5,coin3|s,62,c,a,1,15|s,70,c,a,1,15|s,77,c,a,1,15|w,78,5,s,78,c,a,1,15|s,89,l,a,1,15|s,96,r,a,1,10|s,111,l,a,1,10|w,78,5,s,78,l,a,1,5|w,78,10,s,78,c,a,1,20|s,110,r,a,1,10|s,128,r,a,1,10|s,147,r,a,1,10|s,186,a,a,1,26|s,208,r,a,1,20|s,223,r,a,1,20|s,238,r,a,1,20|s,255,c,a,1,10|s,255,r,a,1,10|s,255,l,a,1,10|s,216,l,a,1,10|s,232,l,a,1,10|s,199,l,a,1,10|s,159,c,a,1,10|s,168,l,a,1,10|s,139,l,a,1,15|c,12,193,5,2x|c,23,228,5,hp|s,50,c,a,1,15|u,23,14,3|w,255,8,s,255,c,a,1,15|t,19,15,Press 'C' to uplink.|t,5,15,Press 'X' to bomb.|t,12,5,Hold 'Z' to lazer.|g,11,316,2|c,20,305,10,lazer|g,22,326,2|g,9,345,2|g,13,355,2|g,22,366,2|g,14,380,2|g,20,380,1|c,25,384,10,hp|u,19,366,4|u,16,355,4|u,12,345,4|u,14,376,5|g,8,400,2|g,22,410,2|g,10,424,2|g,21,441,2|g,8,464,2|g,11,486,2|u,26,400,4|u,9,411,4|u,18,429,4|u,11,441,4|u,12,463,4|u,20,463,4|u,9,496,4|c,5,509,10,hp|c,10,512,10,2x|c,16,509,10,hp|c,21,512,10,coin5|p,525,10|g,24,464,1|p,475,20|s,315,l,a,1,21|s,333,c,a,1,25|s,350,a,a,2,25|s,369,a,a,1,20|p,390,15|s,388,c,a,2,10|w,388,5,s,388,a,a,1,25|s,400,c,a,2,10|s,417,l,a,2,25|s,441,r,a,2,15|s,473,a,a,2,25|w,473,5,s,473,r,a,1,15|w,473,5,s,473,l,a,1,15|w,473,15,s,473,r,a,2,10|w,486,10,s,486,c,a,2,15|w,496,10,s,496,c,a,2,15|p,18,12|c,9,14,5,coin3|g,28,593,2|g,4,787,3|g,15,783,2|g,27,787,3|u,4,776,5|u,10,749,5|u,8,759,5|u,8,707,5|u,25,654,5|u,15,560,5|c,20,560,8,lazer|c,28,589,8,2x|c,16,602,10,coin6|c,4,621,8,hp|g,16,598,3|g,4,656,3|g,8,669,3|u,25,618,5|u,7,634,5|u,12,685,5|g,27,692,3|c,29,682,10,coin4|c,19,696,10,coin4|c,3,692,10,2x|u,25,704,5|g,19,715,2|g,2,720,2|g,3,739,2|g,9,744,2|u,15,776,5|p,794,45|s,577,a,a,3,8|s,590,a,a,4,6|s,604,l,a,2,12|s,622,c,a,4,10|s,650,a,a,3,20|s,671,c,a,4,10|s,696,c,a,4,10|s,731,c,a,4,10|s,756,c,a,4,10|s,768,a,a,4,20|s,619,l,a,3,9|s,676,l,a,3,9|s,708,l,a,3,9|s,744,l,a,3,9|s,634,r,a,3,18|s,688,r,a,3,9|s,731,r,a,3,9|s,756,r,a,3,9|s,791,c,a,3,10|w,791,5,s,791,a,a,4,8|w,791,8,s,791,l,a,4,12|w,791,12,s,791,r,a,4,12|w,790,20,s,790,a,a,3,15|w,791,20,s,791,a,a,3,15|w,790,20,s,790,c,a,4,20|w,791,30,s,791,c,a,4,35|u,27,776,5|s,685,a,a,4,15|s,662,a,a,4,15";
} )();

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
	trees: {
		ch: ' ',
		fg: [ '#373', '#363' ],
		bg: [ '#031', '#040', '#121' ]
	},
	grass: {
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
	water: {
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
	lavashore: {
		ch: '  _.',
		fg: [ '#CB8' ],
		bg: [ '#755', '#855' ]
	},
	wall: {
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

function wall( y, map ) {
	let si = to1d( 0, y, 32 );
	for( let i = 0; i < 32; i++ ) {
		map[ i + si ] = createTile( 'wall', i, y );
		map[ i - 32 + si ] = createTile( 'wall', i, y - 1 );
		map[ i + 32 + si ] = createTile( 'wall', i, y + 1 );
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
			map[ to1d( x, y, 32 ) ] = createTile( rand() > 0.5 ? 'trees' : 'grass', x, y );
		}
	}
	for( let y = 266; y < 533; y++ ) {
		for( let x = 0; x < width; x++ ) {
			map[ to1d( x, y, 32 ) ] = createTile( 'trees', x, y );
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
		lake( x, y, 'water', 'shore', map );
	}
	for( let i = 0; i < 10; i++ ) {
		let x = norm( rand(), 0, 1, 0, 31 );
		let y = norm( rand(), 0, 1, 50, 400 );
		clump( x, y, [ 'trees' ], map );
	}
	for( let i = 0; i < 10; i++ ) {
		let x = norm( rand(), 0, 1, 0, 5 );
		let y = norm( rand(), 0, 1, 0, 266 );
		clump( x, y, [ 'grass' ], map );
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
		lake( x, y, 'lava', 'lavashore', map );
	}
	wall( 0, map );
	wall( 276, map );
	wall( 533, map );

	return map;
}

terrain.set = function() {
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
	if( tile.type === 'grass' || tile.type === 'trees' || tile.type.indexOf( 'rock' ) > -1 ) {
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

( function() {

let display = window.app.display;
let sprites = window.app.sprites;
let terrain = window.app.terrain;
let ls = localStorage;
let game;

let dh = display.height;
let dw = display.width;
let drawText = display.drawText;

// terrain scroll speed
let TSS = 0.9;

let pInt = parseInt;

let black = ( o ) => {
	return `rgba(0,0,0,${o})`;
};

function hedWithinBand( dh, band ) {
	return dh < band || ( dh > ( 360 - band ) && dh < ( 360 ) );
}

class Actor {
	constructor( name ) {
		this.f = 0;
		this.name = name;
		this.speed = 6;
		this.mxsd = 4;
		this.x = 0;
		this.y = 0;
		this.r = 10;
		this.w = 10;
		this.h = 10;
		this.vx = 0;
		this.vy = 0;
		this.ax = 0;
		this.hp = 1;
		this.max_ax = 1;
		this.accel = 0.2;
		this.deccel = 0.05;
		this.hed = 0;
		this.isac = false;
		this.remv = false;
		this.state = '';
		this.expl = 'expl_air';
		this.anim = null;
		this.sprite = null;
		this.ai = function(){};
	}

	setState( state ) {
		if( this.state === state ) {
			return;
		}
		this.state = state;
		this.anim = display.getAnim( this.name + '_' + state );
	}

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

	pointAt( { x, y } ) {
		this.hed = this.getHedTo( { x, y } );
	}

	turn( direction ) {
		if( direction === 'left' ) {
			this.ax = -this.max_ax;
		} else {
			this.ax = this.max_ax;
		}
	}

	turnTowards( { x, y } ){
		let h = this.getHedTo( { x, y } );

		if ( this.hed <= h ) {
			if ( Math.abs( this.hed - h ) < 180 ) {
				this.turn( 'right' );
			} else {
				this.turn( 'left' );
			}
		} else {
			if ( Math.abs( this.hed - h ) < 180 ) {
				this.turn( 'left' );
			} else {
				this.turn( 'right' );
			}
		}
	}

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

	explode() {
		this.remv = true;
		if( this.expl ) {
			game.addPar( this.expl, this.x, this.y );
		}
	}

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
			display.playSound( 'bullet' );
		};

		for( let i = 0; i < n; i++ ) {
			game.setCB( cb, i * 5 + 1, true );
		}
	}

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
		super( 'player' );
		this.x = 400;
		this.y = 400;
		this.r = 25;
		this.max_target_y = -150;
		this.target_y = -150;
		this.setState( 'default' );
		this.lzrcd = 20; // lazer cooldown
		this.lzfrm = 20; // lazer frame (counts cooldown)
		this.lzlvl = 1; // lazer level
		this.max_hp = 100;
		this.hp = this.max_hp;
		this.uplink = null;
		this.bombs = [];
		this.bomb_frame = 0;
	}
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
		}
	}
	bomb() {
		if( this.bombs.length === 0 ) {
			let nbombs = [ 0, 1, 2, 4 ][ game.lvln ];
			for( let i = 0; i < nbombs; i++ ) {
				let b = new game.Bomb( 1, this.x, this.y, this.target_y );
				this.bombs.push( b );
			}
		}
	}
	harpoon() {
		if( !this.uplink ) {
			let h = new game.Harpoon( 1, this.x, this.y );
			this.uplink = h;
			display.playSound( 'harpoon' );
			game.actors.push( h );
		}
	}
	explode() {
		//super.explode();
		if( !game.ncontrol ) {
			display.playSound( 'lvlfail' );
			game.end();
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
			this.target_y -= 4;
			if( this.target_y < this.max_target_y ) {
				this.target_y = this.max_target_y;
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
				this.target_y += 4;
				if( this.target_y > 0 ) {
					this.target_y = 0;
				}
			}
		}
		this.lzfrm++;

		if( this.uplink && this.uplink.remv ) {
			this.uplink = null;
		}

		if( this.bombs.length ) {
			if( this.bomb_frame <= 0 ) {
				this.bomb_frame = 4;
				display.playSound( 'bomb' );
				game.actors.push( this.bombs.shift() );
			} else {
				this.bomb_frame--;
			}
		}
	}
	draw() {
		super.draw();
		display.drawSprite( 'target', this.x, this.y + this.target_y );
		let hpw = 160;
		let chpw = display.normalize( this.hp, 0, this.max_hp, 0, hpw );
		let hph = 10;
		let hpy = dh - hph - 2;
		let hpx = dw - hpw + hpw / 2 - 20;
		let chpx = dw - hpw + chpw / 2 - 20;
		display.rect( {
			x: hpx,
			y: hpy,
			w: hpw,
			h: hph,
			color: 'red',
			outline: true
		} );
		display.rect( {
			x: chpx,
			y: hpy,
			w: chpw,
			h: hph,
			color: 'blue',
			outline: true
		});
		let chpct = Math.round( this.hp * 100 / this.max_hp ) + '%';
		drawText( chpct, hpx - chpct.length * 6.5, hpy + 2, { size: 24, color: 'white' } );
	}
}

class Air extends Actor {
	constructor( name ) {
		super( name );
		this.sprite = name;
		this.expl = 'expl_air';
		this.level = parseInt( name.slice( -1 ) );
		this.dmg = [ 0, 3, 5, 8, 10 ][ this.level ];
		this.mxsd = [ 0, 4, 5, 6, 7 ][ this.level ];
		this.hp = [ 0, 1, 5, 15, 20 ][ this.level ];
		this.max_ax = [ 0, 1, 1, 1.5, 2 ][ this.level ];
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
			if( !this.is_dead ) {
				this.anim = display.getAnim( this.name );
			}
		}, 6, true );
	}

	explode() {
		super.explode();
		display.playSound( 'expa' );
		game.addPoints( this.level * 50 );
	}

	update() {
		super.update();
		let pl = game.player;
		let collision = this.coll( { x: pl.x, y: pl.y, r: sprites.pl_sz } );
		if( collision ) {
			display.playSound( 'hit' );
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
		this.max_ax = 2;
		this.is_dead = false;
	}

	explode() {
		let v = 50;
		for( let i = 0; i < 5; i++ ) {
			game.addPar( this.expl, this.x - v / 2 + Math.random() * v, this.y - v / 2 + Math.random() * v );
		}
		this.anim = display.getAnim( this.deadsprite );
		this.is_dead = true;
	}

	damage( n ) {
		super.damage( n );
		if( !this.is_dead ) {
			this.anim = display.getAnim( this.name + 'dmg' );
			game.setCB( () => {
				if( !this.is_dead ) {
					this.anim = display.getAnim( this.name );
				}
			}, 6, true );
		}
	}

	getY() {
		return ( 800 - this.ty ) * 32 + terrain.getYOffset( game.tyoff );
	}

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
			if( !this.is_dead && this.turret_anim ) {
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
		this.fire_rate = [ 0, 170, 130, 100 ][ this.level ];
		this.ai = () => {
			let pl = game.player;
			if( !this.is_dead && this.getY() > 50 && this.getY() < dh ) {
				this.turnTowards( pl );
				let dh = Math.abs( this.hed - this.getHedTo( pl ) );
				if( hedWithinBand( dh, 25 ) ) {
					if( display.frame % this.fire_rate === 0 ) {
						this.fire( 'bullet', this.level, 8 );
					}
				}
			}
		};
	}

	explode() {
		super.explode();
		if( !game.ncontrol ) {
			display.playSound( 'expg' );
		}
		game.addPoints( this.level * 200 );
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
		game.addPoints( 100 );
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
		this.begin_level = 0;
		this.end_level = 0;
	}

	update() {
		if( this.isVisible() ) {
			this.remv = true;
			if( this.pause_seconds ) { // pause control
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
			if( this.is_dead ) {
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
		this.max_frames = 60;
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
			if( this.f > this.max_frames ) {
				this.remv = true;
			}
		}
	}

	draw() {
		drawText( this.text, this.x, this.y, { size: this.size, color: this.color } );
	}
}

class Lazer extends Actor {
	constructor( type, is_sound ) {
		super( 'lazer_' + type );
		this.damage = 1;
		this.vy = -10;
		this.vx = 0;
		this.delaying = true;
		this.delay = 0;
		this.x_offset = 0;
		this.sprite = 'lazer' + type;
		this.expl = 'expl_lazer';
		this.sound = is_sound;
	}

	update() {
		this.f++;
		if( this.delaying && this.f > this.delay ) {
			const { x, y } = game.player;
			this.delaying = false;
			this.x = x + this.x_offset;
			this.y = y;
			if( this.sound ) {
				display.playSound( 'lazer1' );
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
		if( !this.delaying ) {
			super.draw();
		}
	}
}

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
			display.playSound( 'hit' );
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
		this.target_y = ty;
		this.sprite = 'bomb' + type;
		this.max_frames = 40;
		this.r = 7;
		this.expl = 'expl_bomb';
	}

	explode() {
		this.remv = true;
		game.addPar( this.expl, this.x, this.y, true );
	}

	update() {
		this.y = this.sy +
			display.normalize( this.f, 0, this.max_frames, 0, this.target_y ) +
			this.max_frames * game.tss;
		this.f++;
		if( this.f === this.max_frames ) {
			for( let i = 0; i < game.actors.length; i++ ) {
				let act = game.actors[ i ];
				if( ( act instanceof GroundTank || act instanceof GroundCache ) && !act.is_dead ) {
					let collision = this.coll( act );
					if( collision ) {
						display.playSound( 'sand' );
						act.damage( 1 );
						break;
					}
				}
			}
			display.playSound( 'bombg' );
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
		this.max_frames = 40;
		this.r = 7;
		this.vy = 5;
		this.expl = 'expl_bomb';
		this.connected = false;
		this.upload_frames = 120;
		this.maxdist = 300;
		this.plug = null;
	}

	update() {
		let pl = game.player;
		this.f++;
		this.y += this.vy;
		this.x += this.vx;
		if( this.f === this.max_frames ) {
			if( this.connected ) {
				display.playSound( 'upl' );
				game.addText( 'Upload success!', '#5E5' );
				this.plug.is_dead = true;
				game.addPoints( 5000 );
			}
			this.explode();
			return;
		}

		if ( this.connected ) {
			this.y += game.tss;
			let dist = display.distance( this.x, this.y, pl.x, pl.y );
			if( this.f % 20 === 0 ) {
				display.playSound( 'blip' );
			}

			if( dist > this.maxdist ) {
				display.playSound( 'uplf' );
				this.explode();
				game.addText( 'Disconnect!', '#E55' );
			}
		} else {
			for( let i = 0; i < game.actors.length; i++ ) {
				let act = game.actors[ i ];
				if( act instanceof Plug && !act.is_dead ) {
					let collision = this.coll( act );
					if( collision ) {
						game.addText( 'Uploading...' );
						this.connected = true;
						this.vx = this.vy = this.f = 0;
						this.x = act.x;
						this.y = act.y;
						this.max_frames = act.nframes;
						this.plug = act;
						break;
					}
				}
			}
		}
	}

	draw() {
		const { x: plx, y: ply } = game.player;
		display.drawSprite( this.sprite, this.x, this.y );
		display.line( { x: this.x, y: this.y, x2: plx, y2: ply, color: '#EEE' } );
		if( this.connected ) {
			display.line( { x: this.x + 3, y: this.y, x2: plx, y2: ply, color: '#AAF' } );
			display.line( { x: this.x - 3, y: this.y, x2: plx, y2: ply, color: '#AAF' } );
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
		this.max_frames = 60 * 6;
		this.accel = 0.2;
		this.max_ax = 3;
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

			if( this.name === 'pwrhp' || this.name === 'pwrlazer' || this.name === 'pwr2x' ) {
				this.turn( 'left' );
				if( Math.random() > 0.5 ) {
					this.acc();
				}
			}
		};
	}

	update() {
		super.update();
		if( this.f === this.max_frames ) {
			this.remv = true;
		}
		let collision = this.coll( game.player );
		if( collision ) {
			this.remv = true;
			if( this.name === 'pwrhp' ) {
				game.player.hp += game.player.max_hp * 0.5;
				if( game.player.hp > game.player.max_hp ) {
					game.player.hp = game.player.max_hp;
				}
				display.playSound( 'hp' );
			}
			if( this.name === 'pwrlazer' ) {
				game.player.lzlvl++;
				if( game.player.lzlvl > 3 ) {
					game.player.lzlvl = 3;
				}
				display.playSound( 'special' );
			}
			if( this.name === 'pwrcoin' ) {
				game.addPoints( 1000 );
				display.playSound( 'coin' );
			}
			if( this.name === 'pwr2x' ) {
				game.smult *= 2;
				display.playSound( 'special' );
			}
		}
	}

	draw() {
		if( this.f > this.max_frames / 2 ) {
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
	start() {
		display.playSound( 'lvlstart' );
		game.loading = true;
		setTimeout( () => {
			game.loading = false;
			game.started = true;
			game.paused = false;
			game.scrolling = true;
			game.lvln = 1;
			game.actors = [];
			game.spawns = [];
			game.createObjects();
			game.player = new Player();
			game.score = 0;
			game.smult = 1;
			game.spawn_frame = 0;
			game.tss = TSS;
			game.camToLvl( game.lvln );
			game.fade( true );
		}, 100 );
	},
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
	end( vic ) {
		game.cbs = [];
		game.cbs_pll = [];
		game.ncontrol = true;
		let v = 50;
		let r = Math.random;
		let p = game.player;
		if( vic ) {
			display.playSound( 'lvlcomplete' );
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
			display.playSound( 'beaconupload' );
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
	endLevel() {
		game.tss = 0;
		const sp = 10;
		for( let i = 0; i < 5; i++ ) {
			game.setCB( () => {
				display.playSound( 'lvlcomplete' );
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
			display.playSound( 'lvlstart' );
		}, 5 * 60 );
	},
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
			if( cb_obj.current_frame >= cb_obj.max_frames ) {
				cb_obj.cb();
				this.cbs.shift();
			}
		}
		this.cbs_pll = this.cbs_pll.filter( ( cb_obj ) => {
			cb_obj.current_frame++;
			if( cb_obj.current_frame >= cb_obj.max_frames ) {
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
			drawText( 'PLANET: OFFLINE', 222, 400, { size: 42, color: 'white' } );
			drawText( 'Press any key to start.', 222, 600, { size: 28, color: 'white' } );
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
			drawText( 'NEW HIGH SCORE!', 220, 120 + Math.random() * 3, { size: 42, color: 'cyan' } );
		}
		if( game.vic ) {
			drawText( 'VICTORY!', 307, 220 + Math.random() * 3, { size: 42, color: 'green' } );
		}
		if( !game.ncontrol ) {
			game.player.draw();
		}

		drawText( 'ESC to pause, "m" to mute', 20, 20, { size: 16 } );
		drawText( 'SCORE: ' + game.score + ' x' + game.smult, dw - 260, 20, { size: 16 } );

		if( game.paused ) {
			display.rect( { x: 400, y: 400, w: 800, h: 800, color: black( 0.3 ) } );
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
			max_frames: n,
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
	addPoints( p ) {
		game.score += p * game.smult;
	},
	createObjects() {
		game.level_frame = 0;
		let l = window.app.level.split( '|' ).map( ( a ) => {
			return a.split( ',' );
		} );
		terrain.set( 'main' );
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
			if( k === 'escape' ) {
				game.paused = !game.paused;
			}
			if( k === 'm' ) {
				display.mute = !display.mute;
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
