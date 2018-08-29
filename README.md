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
