console.info('%cFull source code can be found at\nhttps://github.com/M1lken01/bbb-round-two', 'color: yellow; font-size: 2rem;');
const getHighScore = () => parseInt(localStorage.getItem('high-score') ?? '0');
const setHighScore = (value: number) => localStorage.setItem('high-score', Math.floor(value).toString());
const gameMap = document.querySelector('div#game') as HTMLDivElement;
const menuContainer = document.querySelector('div#menu-container') as HTMLDivElement;
const gameContainer = document.querySelector('div#game-container') as HTMLDivElement;
const powerUpsContainer = document.querySelector('div#powerups') as HTMLDivElement;
const scoreSpan = document.querySelector('#score>span')!;
const movesLeftSpan = document.querySelector('#moves>span')!;
const powerUpsInfo = document.querySelector('div#powerup-info')!;

interface PowerUp {
  name: string;
  description: string;
  sprite: string;
  activate(game: Game, player: Player): boolean;
  selectable: boolean;
  hotkey?: string;
}

const powerUpTypes: PowerUp[] = [
  {
    name: 'Teleport',
    description: 'Bármelyik mezőre ugorhatsz 1 kattintással. Manuálisan aktiválható.',
    sprite: 'teleport',
    hotkey: 't',
    activate: (game, player): boolean => {
      player.setPos(game.getSelected() ?? game.getRandomPos());
      game.removeSelected();
      return true;
    },
    selectable: true,
  },
  {
    name: 'Lépés Növelés',
    description: 'A maradék lépéseid száma 5-tel növekszik. Automatikusan aktiválódik.',
    sprite: 'move_increase',
    activate: (game, player): boolean => {
      game.incMoveLimit(5);
      return true;
    },
    selectable: false,
  },
  {
    name: 'Gyümölcs Növelő',
    description: 'A kattintott mezőn lévő gyümölcsök száma növekszik. Manuálisan aktiválható.',
    sprite: 'grow_plants',
    hotkey: 'r',
    activate: (game, player): boolean => {
      const pos = game.getSelected() ?? game.getRandomPos();
      if (!isFruit(game.getItemAt(pos))) return false;
      game.growFruit(game.getSelected() ?? game.getRandomPos(), Math.floor(Math.random() * 3) + 2);
      game.removeSelected();
      return true;
    },
    selectable: true,
  },
  {
    name: 'Betakarítás',
    description: 'A körülötted lévő gyümölcsöket össze gyűjtöd. Manuálisan aktiválható.',
    sprite: 'multi_collect',
    hotkey: 'e',
    activate: (game, player): boolean => {
      game.getNeighborPositions(player.getPos()).forEach((pos) => {
        if (game.getItemAt(pos) !== undefined) player.collectItemAt(pos);
      });
      return true;
    },
    selectable: false,
  },
];
const fruitFlavors = ['apple', 'pear', 'strawberry'] as const;
type Fruit = { flavor: (typeof fruitFlavors)[number]; amount: number };
type Vec2 = { x: number; y: number };
type Item = Fruit | PowerUp | undefined;
type GameMapRow = Array<Item>;
type GameMap = Array<GameMapRow>;
const mapSize = [15, 12];
const difficulties = {
  hard: { moveLimit: 20, fixedPowerUps: [], extraPowerUps: 2, fruitRate: 1 / 5, fruitAmounts: [10, 8, 6, 4, 2, 1] },
  normal: { moveLimit: 30, fixedPowerUps: [...powerUpTypes], extraPowerUps: 2, fruitRate: 2 / 5, fruitAmounts: [7, 5, 3, 2, 1, 1] },
  easy: { moveLimit: 40, fixedPowerUps: [...powerUpTypes], extraPowerUps: 4, fruitRate: 3 / 5, fruitAmounts: [6, 5, 4, 3, 2, 1] },
};

const isFruit = (item: Item): item is Fruit => item !== undefined && 'flavor' in item;
const isPowerUp = (item: Item): item is PowerUp => item !== undefined && 'sprite' in item;

let imagePaths: string[] = [];
function preloadImages(imagePaths: string[]): void {
  imagePaths.forEach((path) => (new Image().src = path));
  console.info(`Preloading completed and loaded ${imagePaths.length} images!`);
}

function cssSrc(src: string): string {
  if (!imagePaths.includes(src)) imagePaths.push(src);
  return `url('${src}')`;
}

const grassSprite = (): string => cssSrc(`imgs/assets/grass/${Math.floor(Math.random() * 3)}.png`);

function createPowerUpButton(idx: number, hotkey: string, src: string, alt: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.classList.add('rounded-full', 'hover:bg-zinc-900', 'h-20');
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

function createPowerUpInfo(title: string, desc: string, imgSrc: string): HTMLElement {
  const wrapperDiv = document.createElement('div');
  wrapperDiv.classList.add('flex', 'flex-col', 'items-center', 'justify-start');
  const img = document.createElement('img');
  img.classList.add('h-32', 'w-32', 'pixelated');
  img.src = imgSrc;
  img.alt = title;
  const h2 = document.createElement('h2');
  h2.classList.add('text-4xl', 'font-bold', 'mb-4');
  h2.textContent = title;
  const p = document.createElement('p');
  p.classList.add('text-2xl');
  p.textContent = desc;
  wrapperDiv.appendChild(img);
  wrapperDiv.appendChild(h2);
  wrapperDiv.appendChild(p);
  return wrapperDiv;
}

function weightedRandom<T>(items: T[], weights: number[]): T {
  const cumulativeWeights = weights.reduce((acc, weight) => acc + weight, 0);
  const randomIndex = (Math.random() * cumulativeWeights) | 0;
  let cumulativeWeight = 0;
  for (let i = 0; i < items.length; i++) {
    cumulativeWeight += weights[i];
    if (randomIndex < cumulativeWeight) return items[i];
  }
  return items[items.length - 1];
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
  private difficulty = { moveLimit: 0, fixedPowerUps: [...powerUpTypes], extraPowerUps: 2, fruitRate: 2 / 5, fruitAmounts: [7, 5, 3, 2, 1, 1] };
  private width: number;
  private height: number;
  private moveLimit: number;
  private initialMoveLimit: number;
  private map: GameMap = [];
  private mapBlueprint: GameMap = [];
  private hasEnded = false;
  private selectedCell?: Vec2;

  constructor(width: number, height: number, difficulty: any) {
    this.difficulty = difficulty;
    this.width = width;
    this.height = height;
    this.moveLimit = this.difficulty.moveLimit;
    this.initialMoveLimit = this.moveLimit;
    this.generateMap();
  }

  private generateMap(): GameMap {
    const tokens: Item[] = [...this.difficulty.fixedPowerUps];
    const fruitCount = this.width * this.height * this.difficulty.fruitRate;
    const emptyCount = this.width * this.height - fruitCount - this.difficulty.extraPowerUps - tokens.length;
    for (let i = 0; i < fruitCount; i++) {
      tokens.push({
        flavor: fruitFlavors[Math.floor(Math.random() * fruitFlavors.length)],
        amount: weightedRandom([1, 2, 3, 4, 5, 6], this.difficulty.fruitAmounts),
      });
    }
    for (let i = 0; i < this.difficulty.extraPowerUps; i++) {
      tokens.push(powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]);
    }
    for (let i = 0; i < emptyCount; i++) {
      tokens.push(undefined);
    }
    if (tokens.length !== this.width * this.height) console.error('Invalid map generator config!');
    for (let i = tokens.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tokens[i], tokens[j]] = [tokens[j], tokens[i]];
    }
    const newMap: GameMap = [];
    for (let y = 0; y < this.height; y++) {
      const row: Item[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push(tokens.pop() || undefined);
      }
      newMap.push(row);
    }
    this.map = newMap;
    this.mapBlueprint = deepClone(this.map);
    this.drawMap();
    return newMap;
  }

  public restoreMap() {
    this.map = deepClone(this.mapBlueprint);
    this.drawMap();
    updateUI();
  }

  public drawMap() {
    gameMap.innerHTML = '';
    gameMap.style.gridTemplateColumns = `repeat(${this.width + 2}, minmax(0, 1fr))`;
    gameMap.style.gridTemplateRows = `repeat(${this.height + 2}, minmax(0, 1fr))`;
    for (let y = -1; y <= this.height; y++) {
      for (let x = -1; x <= this.width; x++) {
        if (x === -1 || x === this.width || y === -1 || y === this.height) {
          const cell = document.createElement('div');
          cell.style.backgroundImage = grassSprite();
          cell.appendChild(this.createDecor(this.getBorderType(x, y), 'fences'));
          gameMap.appendChild(cell);
        } else {
          const item = this.getItemAt({ x, y });
          const cell = this.createCell({ x, y });
          cell.style.backgroundImage = grassSprite();
          if (!item) {
            if (Math.floor(Math.random() * 10) > 2) cell.appendChild(this.createDecor(Math.floor(Math.random() * 12) + 1, 'foliage'));
          } else if (isPowerUp(item)) {
            cell.appendChild(this.createDecor(item.sprite, 'item', 'powerups'));
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
              const neighborConditions = [
                { src: 'x', condition: () => neighbors.t && neighbors.l && neighbors.r && neighbors.b },
                { src: 't_b', condition: () => neighbors.t && neighbors.l && neighbors.r },
                { src: 't_r', condition: () => neighbors.t && neighbors.l && neighbors.b },
                { src: 't_l', condition: () => neighbors.t && neighbors.r && neighbors.b },
                { src: 't_t', condition: () => neighbors.b && neighbors.l && neighbors.r },
                { src: 'i_v', condition: () => neighbors.t && neighbors.b },
                { src: 'i_h', condition: () => neighbors.r && neighbors.l },
                { src: 'c_br', condition: () => neighbors.t && neighbors.l },
                { src: 'c_bl', condition: () => neighbors.t && neighbors.r },
                { src: 'c_tr', condition: () => neighbors.b && neighbors.l },
                { src: 'c_tl', condition: () => neighbors.b && neighbors.r },
                { src: 'end_t', condition: () => neighbors.t },
                { src: 'end_l', condition: () => neighbors.l },
                { src: 'end_r', condition: () => neighbors.r },
                { src: 'end_b', condition: () => neighbors.b },
                { src: 'single', condition: () => true },
              ];
              const neighborData = neighborConditions.find((n) => n.condition())!;
              cell.style.backgroundImage = cssSrc(`imgs/assets/paths/${neighborData.src}.png`);
            }
          }
          gameMap.appendChild(cell);
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
    const score = player!.getFruitsCollected();
    let highScoreText = `. Eddigi rekord: ${getHighScore().toString()}!`;
    if (score > getHighScore()) {
      highScoreText = `. Új rekord (régi: ${getHighScore().toString()})!`;
      setHighScore(score);
    }
    setTimeout(() => alert(`Ideért a vihar. Összeszedett gyümölcsök száma: ${score}${highScoreText}`), 100);
  }

  public startGame(): void {
    this.hasEnded = false;
    this.moveLimit = this.initialMoveLimit;
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
    if (game.isOver()) return false;
    const powerUp = this.powerUps[index];
    if (powerUp.selectable && !trigger) {
      this.selectPowerUp(index);
      return false;
    }
    if (!powerUp.activate(game, this)) return false;
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
  const score = player?.getFruitsCollected() ?? 0;
  movesLeftSpan.textContent = (game.getMoveLimit() - (player?.getMoveCount() ?? 0)).toString();
  scoreSpan.textContent = score.toString();
  if (score === 69) scoreSpan.classList.add('easteregg');
  else scoreSpan.classList.remove('easteregg');
  const plr = document.getElementById('player') || document.createElement('div');
  plr.remove();
  const cells = gameMap.children;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] as HTMLElement;
    const pos = { x: parseInt(cell.getAttribute('data-x')!), y: parseInt(cell.getAttribute('data-y')!) };
    if (game.isOver() && !cell.querySelector('.rain')) {
      const rain = document.createElement('div');
      rain.classList.add('sprite', 'rain');
      rain.style.backgroundImage = cssSrc(`imgs/assets/rain.gif`);
      cell.appendChild(rain);
    }
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
    powerUpsContainer.appendChild(createPowerUpButton(i, powerUp.hotkey ?? '', powerUp.sprite, powerUp.name));
  }
}

window.addEventListener('keydown', (e) => {
  if (!player) return;
  const moveMap: { [key: string]: [number, number] } = {
    ArrowUp: [0, -1],
    w: [0, -1],
    ArrowDown: [0, 1],
    s: [0, 1],
    ArrowLeft: [-1, 0],
    a: [-1, 0],
    ArrowRight: [1, 0],
    d: [1, 0],
  };
  if (moveMap[e.key]) player.move(...moveMap[e.key]);
  if (
    powerUpTypes
      .map((item) => item.hotkey)
      .filter((item) => item !== undefined)
      .includes(e.key.toLowerCase())
  )
    player.handleHotkey(e.key);
  updateUI();
});

document.querySelector('button#start')!.addEventListener('click', () => {
  const chosenDifficulty = ['easy', 'normal', 'hard'][parseInt((document.querySelector('input#difficulty') as HTMLInputElement).value)] as
    | 'easy'
    | 'normal'
    | 'hard';
  if (chosenDifficulty !== 'normal') game = new Game(mapSize[0], mapSize[1], difficulties[chosenDifficulty]);
  gameContainer.classList.remove('!hidden');
  menuContainer.classList.add('!hidden');
  updateUI();
});

document.querySelector('button#retry')!.addEventListener('click', () => {
  player = undefined;
  game.startGame();
  game.restoreMap();
});

document.querySelector('button#reset')!.addEventListener('click', () => {
  window.location.reload();
});

let game = new Game(mapSize[0], mapSize[1], difficulties.normal);
let player: Player | undefined;

preloadImages(imagePaths);

powerUpsInfo.innerHTML = '';
powerUpTypes.forEach((powerUp) => {
  powerUpsInfo.appendChild(createPowerUpInfo(powerUp.name, powerUp.description, `imgs/assets/powerups/${powerUp.sprite}.png`));
});
