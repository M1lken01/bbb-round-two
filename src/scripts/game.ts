const gameMapElement = document.getElementById('game')!;
const movesLeftElement = document.querySelector('#moves>span')!;
const fruitsCollectedElement = document.querySelector('#score>span')!;
const startButton = document.querySelector('button#start')!;
const retryButton = document.querySelector('button#retry')!;
const menuContainer = document.querySelector('div#menu-container') as HTMLDivElement;
const gameContainer = document.querySelector('div#game-container') as HTMLDivElement;

const fruitFlavors = ['apple', 'pear', 'strawberry'] as const;
type Fruit = { flavor?: (typeof fruitFlavors)[number]; amount: number };
type Vec2 = { x: number; y: number };
type LootWeights = { [key: number]: number };

let imagePaths: string[] = [];
function preloadImages(imagePaths: string[]) {
  imagePaths.forEach((path) => {
    new Image().src = path;
  });
}

function cssSrc(src: string): string {
  imagePaths.push(src);
  return `url('${src}')`;
}

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
  public map: Fruit[][] = [];
  private mapBlueprint: Fruit[][] = [];
  private lootWeights: LootWeights;
  private hasEnded = false;

  constructor(width: number, height: number, moveLimit: number, lootWeights: LootWeights) {
    this.width = width;
    this.height = height;
    this.moveLimit = moveLimit;
    this.lootWeights = lootWeights;
    this.generateMap();
  }

  public generateMap() {
    this.map = [];
    for (let y = 0; y < this.height; y++) {
      const row: Fruit[] = [];
      for (let x = 0; x < this.width; x++) {
        const amount = weightedRandom(this.lootWeights);
        row.push({ flavor: amount === 0 ? undefined : fruitFlavors[Math.floor(Math.random() * fruitFlavors.length)], amount });
      }
      this.map.push(row);
    }
    this.mapBlueprint = [...this.map];
    this.drawMap();
  }

  public restoreMap() {
    this.map = this.mapBlueprint;
  }

  public drawMap() {
    gameMapElement.innerHTML = '';
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const fruits = this.getItemAt({ x, y });
        const cell = this.createCell({ x, y });
        if (fruits.amount === 0) {
          cell.style.backgroundImage = cssSrc(`imgs/assets/grass/${Math.floor(Math.random() * 1) + 1}.png`);
          if (Math.floor(Math.random() * 10) > 3) cell.appendChild(this.createDecor(Math.floor(Math.random() * 6) + 1, 'foliage'));
        } else {
          cell.style.backgroundImage = cssSrc(`imgs/assets/paths/single.png`);
          cell.appendChild(this.createDecor(fruits.amount, 'fruit', fruits.flavor));

          const neighbors: { [key: string]: boolean } = { t: false, l: false, r: false, b: false };
          for (const { name, dx, dy } of [
            { name: 't', dx: 0, dy: -1 },
            { name: 'l', dx: -1, dy: 0 },
            { name: 'r', dx: 1, dy: 0 },
            { name: 'b', dx: 0, dy: 1 },
          ]) {
            const neighborX = x + dx;
            const neighborY = y + dy;
            if (neighborX >= 0 && neighborX < this.width && neighborY >= 0 && neighborY < this.height)
              neighbors[name] = this.getItemAt({ x: neighborX, y: neighborY }).amount > 0;
          }
          const hasSides = neighbors.t || neighbors.l || neighbors.r || neighbors.b;
          if (hasSides) {
            let src = 'single';
            if (neighbors.t && neighbors.l && neighbors.r && neighbors.b) src = `x`;
            else if (neighbors.t && neighbors.l && neighbors.r) src = `t_b`;
            else if (neighbors.t && neighbors.l && neighbors.b) src = `t_r`;
            else if (neighbors.t && neighbors.b && neighbors.r) src = `t_l`;
            else if (neighbors.b && neighbors.l && neighbors.r) src = `t_t`;
            else if (neighbors.b && neighbors.t) src = `i_v`;
            else if (neighbors.r && neighbors.l) src = `i_h`;
            else if (neighbors.t && neighbors.l) src = `c_br`;
            else if (neighbors.t && neighbors.r) src = `c_bl`;
            else if (neighbors.b && neighbors.l) src = `c_tr`;
            else if (neighbors.b && neighbors.r) src = `c_tl`;
            else if (neighbors.t) src = `end_t`;
            else if (neighbors.l) src = `end_l`;
            else if (neighbors.r) src = `end_r`;
            else if (neighbors.b) src = `end_b`;
            cell.style.backgroundImage = cssSrc(`imgs/assets/paths/${src}.png`);
          }
        }
        gameMapElement.appendChild(cell);
      }
    }
  }

  private createCell(pos: Vec2): HTMLDivElement {
    const cell = document.createElement('div');
    cell.innerHTML = '';
    cell.setAttribute('data-x', pos.x.toString());
    cell.setAttribute('data-y', pos.y.toString());
    cell.addEventListener('click', () => handleCellClick(pos.x, pos.y));
    return cell;
  }

  private createDecor(id: string | number, type: string, category: string | undefined = undefined): HTMLDivElement {
    const decor = document.createElement('div');
    decor.classList.add('sprite', type);
    decor.style.backgroundImage = cssSrc(`imgs/assets/${category ?? type}/${id.toString()}.png`);
    return decor;
  }

  public getItemAt(pos: Vec2): Fruit {
    return this.map[pos.y][pos.x];
  }

  public setItemAt(pos: Vec2, value: number): void {
    this.getItemAt(pos).amount = value;
  }

  public collectItemAt(pos: Vec2): Fruit {
    const item = this.getItemAt(pos);
    const collectedItem = { ...item };
    item.amount = 0;
    return collectedItem;
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

  public endGame(): void {
    this.hasEnded = true;
  }

  public startGame(): void {
    this.hasEnded = false;
  }

  public isOver(): boolean {
    return this.hasEnded;
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
    if (game.isOver() || this.moveCount < game.getMoveLimit() || game.getMoveLimit() <= 0) {
      const newPos = {
        x: this.pos.x + dx,
        y: this.pos.y + dy,
      };
      if (newPos.x >= 0 && newPos.x < game.getMapWidth() && newPos.y >= 0 && newPos.y < game.getMapHeight()) {
        this.addFruitsCollected(game.collectItemAt(newPos).amount);
        this.pos = newPos;
        this.moveCount++;
      }
    } else {
      game.endGame();
      alert(`Jateknak vege lett. Osszeszedett gyumolcsok szama: ${player.getFruitsCollected()}`);
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
      //cell.innerHTML = '';
      const fruit = cell.querySelector('.fruit');
      if (fruit !== null) fruit.remove();
      plr.id = 'player';
      plr.style.backgroundImage = cssSrc(`imgs/assets/player.png`);
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

startButton.addEventListener('click', () => {
  gameContainer.classList.remove('!hidden');
  menuContainer.classList.add('!hidden');
  updateUI();
});

preloadImages(imagePaths);
