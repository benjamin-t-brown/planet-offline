# Planet: Offline

This is an entry for the js13k 2018 competition.  Theme is 'offline'.

## Description

Rogue AI has infected the planet!  And worse, it has taken over all defense systems and shut down the planetary network!  We cannot access the data we need in order to stop it.  It is a very dangerous mission, but we need you to fly across the planet and manually uplink with our ground databanks in the hopes that we can shut down the AI once and for all.  The more uplinks you complete, the better off we'll be.

## Game

Game can be found at [benjamin-t-brown.github.io/planet-offline/](https://benjamin-t-brown.github.io/planet-offline/)

### Prerequisites

The game does not require a build step to edit code, but it does to minify/zip and create the final entry.

Nodejs (v9+), npm, zip.  Should work on Windows or Linux.  Original dev was mostly on Windows.

Spawns are edited using [tiled](https://www.mapeditor.org/) map editor.

### Dev Environment Setup

Install dependencies with npm.

```
npm install
```

Build project (including minification and original zipping):

```
# operates in dist/* directory: erases and rewrites concat.js, main.js, index.html, main.zip
npm run build
```

Run advzip for greater zip compression.  (Not included in build for operating system compatibility reasons)

```
advzip -z4 dist/main.zip
```

If level spawns are edited and exported as map/map1.json, run the included map building script to generate the 'levels.js' file.

```
node build-map.js
```

## Built With

* [jsfxr (npm version)](https://www.npmjs.com/package/jsfxr) - for sound.
* [tiled](https://www.mapeditor.org/) - for editing spawns.

## Acknowledgments

* Thank goodness for the js13k [resources](https://js13kgames.github.io/resources/) page, it is very useful.
* The idea for this game comes from an old Ambrosia Software game for Mac called Deimos Rising [(example video)](https://www.youtube.com/watch?v=_dPjpHjmcB8).

## Original Notes

These were my original notes.  I didn't fit everything in, but I'm pleased with the end result.

* Gameplay Rules *

The goal is to complete the game (primary), get max score (secondary).  It should be fairly difficult to complete the game, but fairly easy to finish the first level, however it should be very hard to get max score.

A ship flies north, it can fire lazers in the air and bombs to the ground.
- Lazer has 4 levels, if you die, lazer level is reduced by one (level 1 min)
	* each level increases fire rate/spray, num projectiles
- Lazers spawn as powerpups to pick up

Enemies consist of air and ground vehicles:

- Air vehicles have a set path and damage the ship via ramming.
	* 4 levels of air vehicles, each level increases speed/armor/tracking
- Ground vehicles have turrets which can shoot bullets.
	* 3 levels of ground vehicles, each level increases bullet damage/rate,armor
EXTRA - Air walls are just walls that fly down from the sky that block all projectiles

* Powerups *
- Lazers powerup, increases your lazer level, if at max, heals ship
- Health Restore, restores 50% hp
- 2x point modifier, adds 2x to your points modifer from this point on
- Extra Life, gives another life
- '$N', grants some number of extra points

EXTRA
	final boss (might not fit in 13kb with something too specialized)

* Setting *

4 Levels, each level has a different generated background which looks like some kind of terrain, but a pre-specified list of
enemies.

A "level" is:
	scroll speed
	a generated background
	3x list of air enemy spawns
	2x list of ground enemy spawns
	list of ground containers + array of loot

A spawn list is:
	[ spawn_rate, enemy_name, enemy_name...., 0, seconds_to_next_spawn ]

Points:
	Air ships: 10 x ship level
	Ground ships: 25 x ship level
	Containers: 101

UI
	Main menu shows "start", and list of high scores
	Main game screen shows hp, current level, lazer level, points, and #lives
	End game screen asks for input if score is in top 10, name length 4 max
