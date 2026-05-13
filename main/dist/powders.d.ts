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
    any1: any;
    any2: any;
    any3: any;
    any4: any;
    any5: any;
    life: number;
    onFire: boolean;
    constructor(x: number, y: number, type: string | null, directionX?: number, directionY?: number);
    getColor(): string;
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
    noTransfer?: boolean;
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
export declare function energyBehavior(game: Powders, particle: Particle, onBounce?: (game: Powders, particle: Particle, bouncedOn: Particle | null) => void): void;
export declare function staticEnergyBehavior(game: Powders, particle: Particle): void;
export declare function colorCurve(points: {
    offset: number;
    color: string;
}[], position: number): string;
export interface RaycastConfig {
}
export declare abstract class Renderer {
    abstract init(game: Powders): void;
    abstract destroy(): void;
    abstract renderGrid(game: Powders): void;
    abstract renderParticles(game: Powders): void;
    abstract renderDebug(game: Powders): void;
    abstract renderPost(game: Powders): void;
    abstract get isGPU(): boolean;
    abstract get supportsSpecialGraphics(): boolean;
    abstract get supportsParticles(): boolean;
}
export declare class CPURenderer extends Renderer {
    ctx: CanvasRenderingContext2D | null;
    init(game: Powders): void;
    destroy(): void;
    renderGrid(game: Powders): void;
    renderParticles(game: Powders): void;
    renderDebug(game: Powders): void;
    renderPost(game: Powders): void;
    get isGPU(): boolean;
    get supportsSpecialGraphics(): boolean;
    get supportsParticles(): boolean;
}
export declare class GPURenderer extends Renderer {
    ctx: WebGL2RenderingContext | null;
    particleShaderProgram: WebGLProgram | null;
    gridShaderProgram: WebGLProgram | null;
    brushPreviewProgram: WebGLProgram | null;
    framebuffer: WebGLFramebuffer | null;
    cellWidth: number;
    cellHeight: number;
    init(game: Powders): void;
    private shaderInit;
    private createParticleShaderProgram;
    private createGridShaderProgram;
    private createShaderProgram;
    private compileShader;
    destroy(): void;
    renderGrid(game: Powders): void;
    renderParticles(game: Powders): void;
    renderDebug(game: Powders): void;
    renderPost(game: Powders): void;
    get isGPU(): boolean;
    get supportsSpecialGraphics(): boolean;
    get supportsParticles(): boolean;
}
export declare class Powders {
    canvas: HTMLCanvasElement;
    renderer: Renderer;
    rendererOption: string;
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
    particleLimit: number | null;
    particlesEnabled: boolean;
    particles: {
        x: number;
        y: number;
        width: number;
        height: number;
        color: string;
    }[];
    disableAi: boolean;
    noSpecialGraphics: boolean;
    _noInput: boolean;
    highQualityExplode: boolean;
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
    constructor(renderer?: Renderer);
    private doAutoRenderer;
    selectorMatch(selector: string, particle: Particle): boolean;
    parseSelector(selector: string): (string | null)[];
    initHtml(): void;
    closeUi(id: string): void;
    openUi(id: string): void;
    fixParticleErrors(particle: Particle): void;
    toggleUi(id: string): void;
    mouseInBounds(): boolean;
    getSettingsDict(): {
        [key: string]: any;
    };
    getLocalStorageSettings(): {
        [key: string]: any;
    } | undefined;
    saveSettings(): void;
    initSettings(): void;
    getSetting(key: string, fromLocal?: boolean): any;
    renderDebugSquare(x: number, y: number, width: number, height: number, color: string, forTick?: boolean): void;
    processTypeId(typeId: string | null, original?: string | null, placeholderIndex?: Map<string, string | null>, single?: boolean): (string | null)[] | (string | null);
    isFree(x: number, y: number): boolean;
    canSwap(type: string | null, x: number, y: number, sameTypeSwap?: boolean): boolean;
    spawnParticle(x: number, y: number, type: string | null, replace?: boolean, forceMainGrid?: boolean): Particle | undefined;
    removeParticle(x: number, y: number, forceMainGrid?: boolean): void;
    toggleSettings(): void;
    listenInputs(): void;
    drawParticleRect(x: number, y: number, width: number, height: number, type: string | null, replace?: boolean): Particle[];
    drawParticleLine(x1: number, y1: number, x2: number, y2: number, type: string | null, replace?: boolean, width?: number): Particle[];
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
    backupRenderGrid(): void;
    backupRenderDebug(): void;
    backupRenderParticles(): void;
    backupRenderPost(): void;
    convertCssToHex(cssColor: string): string;
    render(): void;
    getParticle(x: number, y: number): Particle | null;
    startGame(): void;
    reset(generateTerrain?: boolean): void;
    resize(width: number, height: number, generateTerrain?: boolean): void;
    updatePositions(): void;
    crushParticle(x: number, y: number): void;
    generateSimpleTerrain(): void;
    getParticlesInLine(x1: number, y1: number, x2: number, y2: number): Particle[];
    explode(x: number, y: number, radius: number, force: number, lightFire?: boolean, nuclear?: boolean): {
        x: number;
        y: number;
        particle: Particle | null;
    }[];
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