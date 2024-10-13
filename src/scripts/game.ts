const gameMapElement = document.getElementById('game')!;
const movesLeftElement = document.querySelector('#moves>span')!;
const fruitsCollectedElement = document.querySelector('#score>span')!;
const startButton = document.querySelector('button#start')!;
const retryButton = document.querySelector('button#retry')!;
const restartButton = document.querySelector('button#restart')!;
const menuContainer = document.querySelector('div#menu-container') as HTMLDivElement;
const gameContainer = document.querySelector('div#game-container') as HTMLDivElement;
const powerUpsContainer = document.querySelector('div#powerups') as HTMLDivElement;

interface PowerUp {
  name: string;
  description: string;
  activate(game: Game, player: Player): void;
  selectable: boolean;
  hotkey?: string;
}

const teleport: PowerUp = {
  name: 'Teleport',
  description: 'Instantly move to any position on the map.',
  hotkey: 't',
  activate: (game, player) => {
    player.setPos(game.getSelected() ?? game.getRandomPos());
    game.removeSelected();
  },
  selectable: true,
};

const moveIncrease: PowerUp = {
  name: 'Move Increase',
  description: 'Increase available moves by 5.',
  activate: (game, player) => {
    game.incMoveLimit(5);
  },
  selectable: false,
};

const growPlants: PowerUp = {
  name: 'Grow Plants',
  description: 'Grows a fruit.',
  hotkey: 'r',
  activate: (game, player) => {
    game.growFruit(game.getSelected() ?? game.getRandomPos(), Math.floor(Math.random() * 3) + 2);
    game.removeSelected();
  },
  selectable: true,
};

const multiCollect: PowerUp = {
  name: 'Multi Collect',
  description: 'Collect fruits from all adjacent tiles.',
  hotkey: 'e',
  activate: (game, player) => {
    game.getNeighborPositions(player.getPos()).forEach((pos) => {
      const item = game.getItemAt(pos);
      if (item !== undefined) player.collectItemAt(pos);
    });
  },
  selectable: false,
};

const powerUpTypes = [teleport, moveIncrease, growPlants, multiCollect];
const fruitFlavors = ['apple', 'pear', 'strawberry'] as const;
type Fruit = { flavor?: (typeof fruitFlavors)[number]; amount: number };
type Vec2 = { x: number; y: number };
type LootWeights = { [key: string]: number };
type Item = Fruit | PowerUp | undefined;
type GameMapRow = Array<Item>;
type GameMap = Array<GameMapRow>;

const isFruit = (item: Item): item is Fruit => item !== undefined && 'flavor' in item;
const isPowerUp = (item: Item): item is PowerUp => item !== undefined && 'name' in item;

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

const grassSprite = (): string => cssSrc(`imgs/assets/grass/${Math.floor(Math.random() * 3)}.png`);
const powerUpSprite = (name: string): string => name.replaceAll(' ', '').toLowerCase();

function createPowerUpButton(idx: number, hotkey: string, src: string, alt: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.classList.add('rounded-full', 'hover:bg-zinc-900');
  if (player!.getSelectedPowerUpIdx() === idx) button.classList.add('selected');
  button.title = `Hotkey: ${hotkey}`;
  button.addEventListener('click', () => {
    if (player!.activatePowerUp(idx)) button.remove();
    updateUI();
  });
  const img = document.createElement('img');
  img.classList.add('w-20');
  img.src = `imgs/assets/powerups/${src}.png`;
  img.alt = alt;
  button.appendChild(img);
  return button;
}

function weightedRandom(probabilities: LootWeights): string {
  const keys = Object.keys(probabilities);
  const weights = Object.values(probabilities);
  const random = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  let cumulativeWeight = 0;
  for (let i = 0; i < keys.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) return keys[i];
  }
  return keys[0];
}

function handleCellClick(x: number, y: number): void {
  const pos = { x, y };
  if (!player) player = new Player(pos);
  else game.selectCell(pos);
  updateUI();
}

function getRandomElement<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

function deepClone(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => deepClone(item));
  const clone: any = {};
  for (const key in obj) if (obj.hasOwnProperty(key)) clone[key] = deepClone(obj[key]);
  return clone;
}

class Game {
  private width: number;
  private height: number;
  private moveLimit: number;
  private map: GameMap = [];
  private mapBlueprint: GameMap = [];
  private lootWeights: LootWeights;
  private hasEnded = false;
  private selectedCell?: Vec2;

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
      const row: GameMapRow = [];
      for (let x = 0; x < this.width; x++) {
        const result = weightedRandom(this.lootWeights);
        let item;
        if (result === 'powerup') item = getRandomElement(powerUpTypes);
        else if (result !== '0') item = { flavor: fruitFlavors[Math.floor(Math.random() * fruitFlavors.length)], amount: parseInt(result) };
        row.push(item);
      }
      this.map.push(row);
    }
    this.mapBlueprint = deepClone(this.map);
    this.drawMap();
  }

  public restoreMap() {
    this.map = deepClone(this.mapBlueprint);
    this.drawMap();
    updateUI();
  }

  public drawMap() {
    gameMapElement.innerHTML = '';
    gameMapElement.style.gridTemplateColumns = `repeat(${this.width + 2}, minmax(0, 1fr))`;
    gameMapElement.style.gridTemplateRows = `repeat(${this.height + 2}, minmax(0, 1fr))`;
    for (let y = -1; y <= this.height; y++) {
      for (let x = -1; x <= this.width; x++) {
        if (x === -1 || x === this.width || y === -1 || y === this.height) {
          const cell = document.createElement('div');
          cell.style.backgroundImage = grassSprite();
          cell.appendChild(this.createDecor(this.getBorderType(x, y), 'fences'));
          gameMapElement.appendChild(cell);
        } else {
          const item = this.getItemAt({ x, y });
          const cell = this.createCell({ x, y });
          cell.style.backgroundImage = grassSprite();
          if (!item) {
            if (Math.floor(Math.random() * 10) > 2) cell.appendChild(this.createDecor(Math.floor(Math.random() * 12) + 1, 'foliage'));
          } else if (isPowerUp(item)) {
            cell.appendChild(this.createDecor(powerUpSprite(item.name), 'item', 'powerups'));
          } else {
            cell.style.backgroundImage = cssSrc(`imgs/assets/paths/single.png`);
            cell.appendChild(this.createDecor(item.amount, 'item', item.flavor));

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
                neighbors[name] = isFruit(this.getItemAt({ x: neighborX, y: neighborY }));
            }
            if (neighbors.t || neighbors.l || neighbors.r || neighbors.b) {
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
  }

  private getBorderType(x: number, y: number): string {
    const t = y == -1;
    const b = y == this.height;
    const l = x == -1;
    const r = x == this.width;
    if (t && l) return 'corner_tl';
    if (t && r) return 'corner_tr';
    if (b && l) return 'corner_bl';
    if (b && r) return 'corner_br';
    if (l || r) return 'vertical';
    if (t || b) return 'horizontal';
    return 'single';
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

  public getNeighborPositions(pos: Vec2): Vec2[] {
    const neighbors: Vec2[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const newX = pos.x + dx;
        const newY = pos.y + dy;
        if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) neighbors.push({ x: newX, y: newY });
      }
    }
    return neighbors;
  }

  public getCellElem(pos: Vec2): HTMLDivElement | null {
    return document.querySelector(`[data-x="${pos.x}"][data-y="${pos.y}"]`);
  }

  public getEmptyCellElem(pos: Vec2): HTMLDivElement | null {
    const cell = this.getCellElem(pos)!;
    cell.innerHTML = '';
    return cell;
  }

  public getItemAt(pos: Vec2): Item {
    return this.map[pos.y][pos.x];
  }

  public setItemAt(pos: Vec2, item: Item): void {
    this.map[pos.y][pos.x] = item;
  }

  public growFruit(pos: Vec2, amount: number = 1): boolean {
    const item = this.getItemAt(pos);
    if (!item || !isFruit(item) || !item.flavor) return false;
    item.amount = Math.floor(Math.min(item.amount + amount, 6));
    this.getEmptyCellElem(pos)!.appendChild(this.createDecor(item.amount, 'item', item.flavor));
    return true;
  }

  public collectItemAt(pos: Vec2): Item {
    const item = this.getItemAt(pos);
    if (!item) return item;
    const collectedItem = { ...item };
    if (isFruit(item)) item.amount = 0;
    else if (isPowerUp(item)) this.setItemAt(pos, undefined);
    this.getEmptyCellElem(pos);
    return collectedItem as Item;
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
    alert(`Jateknak vege lett. Osszeszedett gyumolcsok szama: ${player!.getFruitsCollected()}`);
  }

  public startGame(): void {
    this.hasEnded = false;
  }

  public isOver(): boolean {
    return this.hasEnded;
  }

  public incMoveLimit(amount: number = 1): void {
    this.moveLimit += amount;
  }

  public getRandomPos(): Vec2 {
    return { x: Math.floor(Math.random() * game.getMapWidth()), y: Math.floor(Math.random() * game.getMapHeight()) };
  }

  public selectCell(pos: Vec2): void {
    if (player!.getSelectedPowerUpIdx() === undefined) return;
    const shouldRemove = JSON.stringify(this.selectedCell) === JSON.stringify(pos);
    this.removeSelected();
    if (shouldRemove) return;
    this.selectedCell = pos;
    player!.triggerSelected();
  }

  public removeSelected(): void {
    this.selectedCell = undefined;
  }

  public getSelected(): Vec2 | undefined {
    return this.selectedCell;
  }
}

class Player {
  private pos: Vec2;
  private moveCount = 0;
  private fruitsCollected = 0;
  private powerUps: PowerUp[] = [];
  private selectedPowerUpIdx?: number;

  constructor(pos: Vec2) {
    this.pos = pos;
    this.collectItemAt(pos);
    updateUI();
  }

  public getPos(): Vec2 {
    return this.pos;
  }

  public setPos(pos: Vec2): Vec2 {
    this.pos = pos;
    this.collectItemAt(pos);
    return this.pos;
  }

  public hasMovesLeft(): boolean {
    return this.moveCount < game.getMoveLimit() || game.getMoveLimit() <= 0;
  }

  public move(dx: number, dy: number): Vec2 {
    if (game.isOver()) return this.pos;
    const newPos = { x: this.pos.x + dx, y: this.pos.y + dy };
    if (newPos.x >= 0 && newPos.x < game.getMapWidth() && newPos.y >= 0 && newPos.y < game.getMapHeight()) {
      this.collectItemAt(newPos);
      this.pos = newPos;
      this.moveCount++;
      if (!this.hasMovesLeft()) game.endGame();
    }
    return this.pos;
  }

  public collectItemAt(pos: Vec2): void {
    const item = game.collectItemAt(pos);
    if (isFruit(item)) this.addFruitsCollected(item.amount);
    else if (isPowerUp(item)) this.addPowerUp(item);
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

  public handleHotkey(key: string): void {
    const powerUpIndex = this.powerUps.findIndex((item) => item.hotkey === key);
    if (powerUpIndex === -1) return;
    this.activatePowerUp(powerUpIndex);
  }

  public triggerSelected(): void {
    if (this.selectedPowerUpIdx === undefined) return;
    this.activatePowerUp(this.selectedPowerUpIdx, true);
    game.removeSelected();
    this.selectedPowerUpIdx = undefined;
  }

  public activatePowerUp(index: number, trigger: boolean = false): boolean {
    const powerUp = this.powerUps[index];
    if (powerUp.selectable && !trigger) {
      this.selectPowerUp(index);
      return false;
    }
    powerUp.activate(game, this);
    this.powerUps.splice(index, 1);
    updateUI();
    return true;
  }

  public addPowerUp(powerUp: PowerUp) {
    if (powerUp.hotkey === undefined) powerUp.activate(game, this);
    else this.powerUps.push(powerUp);
  }

  public getPowerUps(): PowerUp[] {
    return this.powerUps;
  }

  public selectPowerUp(index: number) {
    this.selectedPowerUpIdx = this.selectedPowerUpIdx === index ? undefined : index;
  }

  public getSelectedPowerUpIdx(): number | undefined {
    return this.selectedPowerUpIdx;
  }
}

function updateUI(): void {
  movesLeftElement.textContent = (player ? game.getMoveLimit() - player.getMoveCount() : game.getMoveLimit()).toString();
  fruitsCollectedElement.textContent = (player ? player.getFruitsCollected() : 0).toString();
  const plr = document.getElementById('player') || document.createElement('div');
  plr.remove();
  const cells = gameMapElement.children;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] as HTMLElement;
    const pos = { x: parseInt(cell.getAttribute('data-x')!), y: parseInt(cell.getAttribute('data-y')!) };

    if (player && player.comparePos(pos)) {
      const item = cell.querySelector('.item');
      if (item !== null) item.remove();
      plr.id = 'player';
      plr.style.backgroundImage = cssSrc(`imgs/assets/player.gif`);
      cell.appendChild(plr);
    }
  }
  if (player === undefined) return;
  powerUpsContainer.innerHTML = '';
  const powerUps = player.getPowerUps();
  for (let i = 0; i < powerUps.length; i++) {
    const powerUp = powerUps[i];
    powerUpsContainer.appendChild(createPowerUpButton(i, powerUp.hotkey ?? '', powerUpSprite(powerUp.name), powerUp.name));
  }
}

window.addEventListener('keydown', (e) => {
  if (!player) return;
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
  if (
    powerUpTypes
      .map((item) => item.hotkey)
      .filter((item) => item !== undefined)
      .includes(e.key.toLowerCase())
  )
    player.handleHotkey(e.key);
  updateUI();
});

startButton.addEventListener('click', () => {
  gameContainer.classList.remove('!hidden');
  menuContainer.classList.add('!hidden');
  updateUI();
});

retryButton.addEventListener('click', () => {
  player = undefined;
  game.restoreMap();
});

preloadImages(imagePaths);

const game = new Game(15, 12, 25, { '0': 0.5, '1': 0.22, '2': 0.12, '3': 0.09, '4': 0.03, '5': 0.015, '6': 0.005, powerup: 0.02 });
let player: Player | undefined;
