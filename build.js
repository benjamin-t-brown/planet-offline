/* eslint no-console: 0, no-process-exit: 0 */
'use strict';

const shell = require( 'child_process' );
const argv = require( 'minimist' )( process.argv.slice( 2 ) );
const fs = require( 'fs' );

const env = Object.create( process.env );
env.NPM_CONFIG_COLOR = 'always';
const files = [ 'jsfxr.js', 'display.js', 'levels.js', 'terrain.js', 'sprites.js', 'game.js' ];

const _execute = async function( cmd ) {
	console.log( cmd );
	return new Promise( ( resolve ) => {
		const obj = shell.exec( cmd, {
			// 'env': env
		}, resolve );
		obj.stdout.pipe( process.stdout );
		obj.stderr.pipe( process.stderr );
	} );
};

const rules = {
	'test': function( cb ) {
		const cmd = `echo "There are no tests :*) (^: "`;
		_execute( cmd ).then( cb );
	},
	'build': async function( cb ) {
		await rules.clean();
		await _execute( `concat ${files.join(' ')} -o ./dist/concat.js` );
		await _execute( `uglifyjs --compress loops=true,sequences=true,dead_code=true,booleans=true,unused=true,if_return=true,join_vars=true,drop_console=true --mangle -o ./dist/main.js -- ./dist/concat.js` );

		//uglifyjs --compress --mangle -o ./dist/main.js -- ./dist/concat.js
		//zip -9 -j dist/main.zip dist/index.html;
		//babel-minify --mangle true ./dist/concat.js -o ./dist/main.js;
		//cd dist && 7za a main.zip index.html -mx9 -mm=LZMA > nul

		const src = fs.readFileSync( './dist/main.js' );
		const out = `<html><head><style>body{margin:0px;overflow:hidden;background-color:gray;}</style></head>
<body><canvas id="c" width="800" height="800" style="position:fixed;transform:translate(-50%,-50%);left:50%;top:50%"></canvas></body>
<footer><script>window.app={};</script><script>
${src}
window.addEventListener('load',()=>{window.app.display.init('c',()=>{window.app.game.init()})})
</script></footer></html>
`;
		fs.writeFileSync( 'dist/index.html', out );

		await _execute( `zip -9 -j dist/main.zip dist/index.html` );
		await _execute( `stat -c '%n %s' dist/main.zip` );
		cb();
	},
	'clean': async function( cb ) {
		const cmd = `rm -f dist/main.js dist/concat.js dist/main.zip`;
		return _execute( cmd ).then( cb || (function(){})() );
	}
};
const rule = argv._.shift();
if ( rules[ rule ] ) {
	rules[ rule ]( function( error ) {
		if ( error ) {
			return process.exit( error.code );
		} else {
			return process.exit( 0 );
		}
	} );
} else {
	console.log( 'Invalid rule in site/scripts.js :', rule, argv );
	console.log( 'Valid rules:', Object.keys( rules ) );
	process.exit( 1 );
}
