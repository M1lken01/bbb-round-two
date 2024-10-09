const gameMapElement = document.getElementById('game')!;
const movesLeftElement = document.querySelector('#moves>span')!;
const fruitsCollectedElement = document.querySelector('#score>span')!;
//const restartButton = document.getElementById('restart-button')!;

//let gameMap: number[][] = [];
type Vec2 = { x: number; y: number };
type LootWeights = { [key: number]: number };

function weightedRandom(probabilities: LootWeights): number {
  const keys = Object.keys(probabilities).map(Number);
  const weights = Object.values(probabilities);
  const random = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  let cumulativeWeight = 0;
  for (let i = 0; i < keys.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) return keys[i];
  }
  return keys[0];
}

function handleCellClick(x: number, y: number) {
  console.log(`Cell clicked at: (${x}, ${y})`);
  if (!player) {
    player = new Player({ x, y });
    console.log(`Player created at: (${x}, ${y})`);
    updateUI();
  }
}

class Game {
  private width: number;
  private height: number;
  private moveLimit: number;
  private map: number[][] = [];
  private mapBlueprint: number[][] = [];
  private lootWeights: LootWeights;

  constructor(width: number, height: number, moveLimit: number, lootWeights: LootWeights) {
    this.width = width;
    this.height = height;
    this.moveLimit = moveLimit;
    this.lootWeights = lootWeights;
    this.generateMap();
  }

  public generateMap(fromBlueprint: boolean = this.mapBlueprint.length === this.height) {
    this.map = [];
    if (!fromBlueprint) gameMapElement.innerHTML = '';
    // ! fix from blueprint
    for (let y = 0; y < this.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.width; x++) {
        const fruits = fromBlueprint ? this.mapBlueprint[y][x] : weightedRandom(this.lootWeights);
        row.push(fruits);
        const cell = fromBlueprint ? (document.querySelector(`[data-x="${x}"][data-y="${y}"]`) as HTMLDivElement) : document.createElement('div');
        cell.innerHTML = '';
        if (!fromBlueprint) {
          cell.setAttribute('data-x', x.toString());
          cell.setAttribute('data-y', y.toString());
          cell.addEventListener('click', () => handleCellClick(x, y));
        }
        if (fruits === 0) {
          cell.style.backgroundImage = `url('imgs/assets/bg${Math.floor(Math.random() * 3) + 1}.png')`;
        } else {
          cell.style.backgroundImage = `url('imgs/assets/grid.png')`;
          const fruit = document.createElement('div');
          fruit.classList.add('h-full', 'w-full', 'flex', 'bg-cover', 'bg-no-repeat');
          fruit.style.backgroundImage = `url('imgs/assets/apple${fruits}.png')`;
          cell.appendChild(fruit);
        }
        if (!fromBlueprint) gameMapElement.appendChild(cell);
      }
      this.map.push(row);
    }
    this.mapBlueprint = this.map;
  }

  public getItemAt(pos: Vec2): number {
    return this.map[pos.y][pos.x];
  }

  public setItemAt(pos: Vec2, value: number): void {
    this.map[pos.y][pos.x] = value;
  }

  public collectItemAt(pos: Vec2): number {
    const item = this.map[pos.y][pos.x];
    this.map[pos.y][pos.x] = 0;
    return item;
  }

  public getMapWidth(): number {
    return this.width;
  }

  public getMapHeight(): number {
    return this.height;
  }

  public getMoveLimit(): number {
    return this.moveLimit;
  }
}

const game = new Game(12, 12, 24, { 0: 0.5, 1: 0.24, 2: 0.12, 3: 0.09, 4: 0.03, 5: 0.015, 6: 0.005 });

class Player {
  private pos: Vec2;
  private moveCount = 0;
  private fruitsCollected = 0;

  constructor(pos: Vec2) {
    this.pos = pos;
  }

  public getPos(): Vec2 {
    return this.pos;
  }

  public setPos(pos: Vec2): Vec2 {
    this.pos = pos;
    return this.pos;
  }

  public move(dx: number, dy: number): Vec2 {
    if (this.moveCount < game.getMoveLimit() || game.getMoveLimit() <= 0) {
      const newPos = {
        x: this.pos.x + dx,
        y: this.pos.y + dy,
      };
      if (newPos.x >= 0 && newPos.x < game.getMapWidth() && newPos.y >= 0 && newPos.y < game.getMapHeight()) {
        this.addFruitsCollected(game.collectItemAt(newPos));
        this.pos = newPos;
        this.moveCount++;
      }
    }
    return this.pos;
  }

  public getMoveCount(): number {
    return this.moveCount;
  }

  public getFruitsCollected(): number {
    return this.fruitsCollected;
  }

  public addFruitsCollected(amount: number = 1): number {
    this.fruitsCollected += amount;
    return this.fruitsCollected;
  }

  public comparePos(otherPos: Vec2): boolean {
    return this.pos.x === otherPos.x && this.pos.y === otherPos.y;
  }
}

let player: Player;

function updateUI() {
  movesLeftElement.textContent = (player ? game.getMoveLimit() - player.getMoveCount() : game.getMoveLimit()).toString();
  fruitsCollectedElement.textContent = (player ? player.getFruitsCollected() : 0).toString();
  const plr = document.getElementById('player') || document.createElement('div');
  plr.remove();
  const cells = gameMapElement.children;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] as HTMLElement;
    const pos = { x: parseInt(cell.getAttribute('data-x')!), y: parseInt(cell.getAttribute('data-y')!) };

    if (player && player.comparePos(pos)) {
      cell.innerHTML = '';
      plr.id = 'player';
      plr.style.backgroundImage = `url('imgs/assets/player.png')`;
      cell.appendChild(plr);
    }
  }
}

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp':
    case 'w':
      player.move(0, -1);
      break;
    case 'ArrowDown':
    case 's':
      player.move(0, 1);
      break;
    case 'ArrowLeft':
    case 'a':
      player.move(-1, 0);
      break;
    case 'ArrowRight':
    case 'd':
      player.move(1, 0);
      break;
  }
  updateUI();
});

/*restartButton.addEventListener('click', () => {
  initializeGame();
});*/

updateUI();
