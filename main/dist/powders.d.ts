export declare class Particle {
    x: number;
    y: number;
    type: string | null;
    directionX: number;
    directionY: number;
    deco: string | null;
    temp: number;
    bvs1: number;
    bvs2: number;
    bvs3: number;
    bvs4: number;
    bvs5: number;
    life: number;
    onFire: boolean;
    constructor(x: number, y: number, type: string | null, directionX?: number, directionY?: number);
    generateColorVariation(): string;
    lightOnFire(): void;
}
interface ParticleReaction {
    with: string;
    result: string | null;
    secondResult?: string | null;
    chance: number;
    behavior?: (game: Powders, particle: Particle, otherParticle: Particle) => void;
}
interface PowderType {
    name: string;
    color: string;
    burnInto?: string | null;
    ignitionPoint?: number;
    colorVariation: number;
    behavior: (game: Powders, particle: Particle) => void;
    onSpawn?: (game: Powders, particle: Particle) => void;
    reverseGravity?: boolean;
    gasGravity?: boolean;
    gasWeight?: number;
    defaultTemp?: number;
    tempTransferRate?: number;
    luminosity?: boolean;
    state: "solid" | "liquid" | "gas" | "energy" | "powder";
    cliffable?: boolean;
    reactions?: ParticleReaction[];
    meltingPoint?: number | null;
    meltingResultSecond?: string | null;
    meltingResult?: string | null;
    freezingPoint?: number | null;
    freezingResult?: string | null;
    freezingResultSecond?: string | null;
    category: string | null;
    weight: number;
    crushResult?: string | null;
    flammability?: number;
    explosionResistance?: number;
}
interface Tool {
    name: string;
    color: string;
    action: (game: Powders, x: number, y: number) => void;
    onTick: boolean;
}
declare class ToolTypes {
    registry: Map<string, Tool>;
    list: string[];
    listElement: HTMLUListElement;
    constructor();
    register(id: string, tool: Tool): void;
    get(id: string): Tool | undefined;
    require(id: string): Tool;
    has(id: string): boolean;
}
declare class PowderTypes {
    registry: Map<string, PowderType>;
    list: string[];
    listElement: HTMLUListElement;
    pickerElement: HTMLDivElement;
    selectedCategory: string | null;
    categories: Map<string, HTMLDivElement>;
    tags: Map<string, Set<string>>;
    static SAND: string;
    static STONE: string;
    static WATER: string;
    static BEDROCK: string;
    static STEAM: string;
    static LASER: string;
    constructor();
    addToTag(id: string, tag: string, strict?: boolean): void;
    registerTag(tag: string): void;
    getTag(tag: string): Set<string> | undefined;
    isTagged(id: string, tag: string): boolean;
    getAllWithTag(tag: string, previousTagsSearched?: Set<string>): PowderType[];
    getAllWithTagId(tag: string): string[];
    tagExists(tag: string): boolean;
    randomFromTag(tag: string): PowderType;
    register(id: string, type: PowderType): void;
    getId(type: PowderType): string | undefined;
    get(id: string): PowderType | undefined;
    require(id: string): PowderType;
    has(id: string): boolean;
}
export declare function n101random(lessZero?: boolean): number;
export declare function powderBehavior(game: Powders, particle: Particle, platforming?: number): void;
export declare function liquidBehavior(game: Powders, particle: Particle): void;
export declare function gasBehavior(game: Powders, particle: Particle): void;
export declare function cloudBehavior(game: Powders, particle: Particle): void;
export declare function solidBehavior(game: Powders, particle: Particle): void;
export declare function energyBehavior(game: Powders, particle: Particle): void;
export declare function staticEnergyBehavior(game: Powders, particle: Particle): void;
export declare function colorCurve(points: {
    offset: number;
    color: string;
}[], position: number): string;
export declare class Powders {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    grid: Particle[][];
    mouseX: number;
    mouseY: number;
    lastMouseX: number;
    lastMouseY: number;
    mouseLeftDown: boolean;
    mouseRightDown: boolean;
    selectedType: string | null;
    selectedTool: string | null;
    tickRate: number;
    tmpGrid: Particle[][] | null;
    private _paused;
    width: number;
    height: number;
    brushSize: number;
    intensifyBrush: boolean;
    keysDown: Set<string>;
    debugRenderShapesInput: HTMLInputElement;
    doDebugRender: boolean;
    isMobile: boolean;
    disableAi: boolean;
    _noInput: boolean;
    debugRenderShapes: {
        x: number;
        y: number;
        width: number;
        height: number;
        color: string;
        forTick: boolean;
    }[];
    set noInput(value: boolean);
    get noInput(): boolean;
    set paused(value: boolean);
    get paused(): boolean;
    constructor();
    getSettingsDict(): {
        [key: string]: any;
    };
    getLocalStorageSettings(): {
        [key: string]: any;
    } | undefined;
    saveSettings(): void;
    initSettings(): void;
    renderDebugSquare(x: number, y: number, width: number, height: number, color: string, forTick?: boolean): void;
    processTypeId(typeId: string | null, original?: string | null, placeholderIndex?: Map<string, string | null>, single?: boolean): (string | null)[] | (string | null);
    isFree(x: number, y: number): boolean;
    canSwap(type: string | null, x: number, y: number): boolean;
    spawnParticle(x: number, y: number, type: string | null, replace?: boolean): void;
    removeParticle(x: number, y: number): void;
    toggleSettings(): void;
    listenInputs(): void;
    drawParticleRect(x: number, y: number, width: number, height: number, type: string | null, replace?: boolean): void;
    drawParticleLine(x1: number, y1: number, x2: number, y2: number, type: string | null, replace?: boolean, width?: number): void;
    getAdjacentParticles(x: number, y: number): Particle[];
    getAdjacentOfType(x: number, y: number, type: string): Particle | null;
    swapParticles(x1: number, y1: number, x2: number, y2: number): void;
    raycast(x: number, y: number, angle: number, maxDist?: number): {
        x: number;
        y: number;
        particle: Particle | null;
    };
    update(): void;
    toggleDebug(): void;
    mouseDraw(): void;
    getParticlesInCircle(centerX: number, centerY: number, radius: number): Particle[];
    getParticlesInSquare(x: number, y: number, width: number, height: number): Particle[];
    render(): void;
    getParticle(x: number, y: number): Particle | null;
    startGame(): void;
    reset(generateTerrain?: boolean): void;
    resize(width: number, height: number, generateTerrain?: boolean): void;
    updatePositions(): void;
    crushParticle(x: number, y: number): void;
    generateSimpleTerrain(): void;
    getParticlesInLine(x1: number, y1: number, x2: number, y2: number): Particle[];
    explode(x: number, y: number, radius: number, force: number, lightFire?: boolean, nuclear?: boolean): void;
}
export declare function initPowders(): void;
export declare const powderTypes: PowderTypes;
export declare const toolTypes: ToolTypes;
export declare function startGame(): void;
export declare function getGame(): Powders | null;
declare const _default: {
    startGame: typeof startGame;
    getGame: typeof getGame;
    Powders: typeof Powders;
    Particle: typeof Particle;
};
export default _default;
//# sourceMappingURL=powders.d.ts.map