const mapWidth = 12;
const mapHeight = 12;
const moveLimit = 20;

let gameMap: number[][] = [];

type Vec2 = { x: number; y: number };

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
    if (this.moveCount < moveLimit || moveLimit <= 0) {
      const newPos = {
        x: this.pos.x + dx,
        y: this.pos.y + dy,
      };
      if (newPos.x >= 0 && newPos.x < mapWidth && newPos.y >= 0 && newPos.y < mapHeight) {
        const fruits = gameMap[newPos.y][newPos.x];
        this.addFruitsCollected(fruits);
        gameMap[newPos.y][newPos.x] = 0;
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

const gameMapElement = document.getElementById('game')!;
const movesLeftElement = document.querySelector('#moves>span')!;
const fruitsCollectedElement = document.querySelector('#score>span')!;
//const restartButton = document.getElementById('restart-button')!;

function initializeGame() {
  generateMap();
  updateUI();
}

function weightedRandom(probabilities: { [key: number]: number }): number {
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

const probabilities = { 0: 0.5, 1: 0.24, 2: 0.12, 3: 0.09, 4: 0.03, 5: 0.015, 6: 0.005 };

function calculateColor(moveCount: number): string {
  if (moveLimit <= 0) return '#ff0000';
  if (moveCount < 0) moveCount = 0;
  const ratio = moveCount / moveLimit;
  const red = Math.round(255 * ratio);
  const green = Math.round(255 * (1 - ratio));
  return `#${((1 << 24) + (red << 16) + (green << 8)).toString(16).slice(1)}`;
}

function generateMap() {
  gameMap = [];
  gameMapElement.innerHTML = '';
  for (let y = 0; y < mapHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const fruits = weightedRandom(probabilities);
      row.push(fruits);

      const cell = document.createElement('div');
      cell.classList.add('h-20', 'w-20', 'flex', 'items-center', 'justify-center', 'bg-zinc-500', 'hover:border', 'hover:cursor-pointer', 'text-xl');
      cell.setAttribute('data-x', x.toString());
      cell.setAttribute('data-y', y.toString());
      cell.textContent = fruits.toString();
      cell.addEventListener('click', () => handleCellClick(x, y));

      gameMapElement.appendChild(cell);
    }
    gameMap.push(row);
  }
}

function handleCellClick(x: number, y: number) {
  console.log(`Cell clicked at: (${x}, ${y})`);
  if (!player) {
    player = new Player({ x, y });
    console.log(`Player created at: (${x}, ${y})`);
    updateUI();
  }
}

function updateUI() {
  movesLeftElement.textContent = (moveLimit - (player.getMoveCount() || 0)).toString();
  fruitsCollectedElement.textContent = (player.getFruitsCollected() || 0).toString();

  const cells = gameMapElement.children;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] as HTMLElement;
    const pos = { x: parseInt(cell.getAttribute('data-x')!), y: parseInt(cell.getAttribute('data-y')!) };

    if (player && player.comparePos(pos)) {
      cell.style.backgroundColor = calculateColor(player.getMoveCount());
      cell.textContent = '0'; // ! use gamemap to update values
    } else {
      cell.style.backgroundColor = 'color';
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

initializeGame();
