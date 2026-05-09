export class Particle {
    x: number;
    y: number;
    type: string | null;
    directionX: number; // Direction X for energy
    directionY: number; // Direction Y for energy
    deco: string | null; // For visual variations, like different sand colors
    temp: number; // For temperature-based interactions

    constructor(x: number, y: number, type: string | null, directionX: number = 0, directionY: number = 0) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.directionX = directionX;
        this.directionY = directionY;
        if (type) {
            const powderType = powderTypes.require(type);
            this.temp = powderType.defaultTemp ?? 22;
        } else {
            this.temp = 22; // Room temperature as default for ambient temperature
        }
        this.deco = null;
        if (type) {
            const powderType = powderTypes.require(type);
            if (powderType.colorVariation > 0) {
                // Generate a random color variation based on the base color
                this.deco = this.generateColorVariation();
            }
        }
    }

    public generateColorVariation(): string {
        // Simple color variation by adjusting the HSV values randomly within the variation range
        const type = powderTypes.require(this.type!);
        const baseColor = type.color;
        const variation = type.colorVariation;
        const r = Math.min(255, Math.max(0, parseInt(baseColor.slice(1, 3), 16)));
        const g = Math.min(255, Math.max(0, parseInt(baseColor.slice(3, 5), 16)));
        const b = Math.min(255, Math.max(0, parseInt(baseColor.slice(5, 7), 16)));
        let hue = Math.round((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI + 360) % 360);
        let saturation = Math.round(Math.sqrt((r - g) ** 2 + (r - b) * (g - b)) / 255 * 100);
        let value = Math.round(Math.max(r, g, b) / 255 * 100);
        // Do less hue variation to keep general color.
        const hueVariation = variation / 4;
        const saturationVariation = variation / 2;
        const valueVariation = variation / 2;
        hue = (hue + (Math.random() * 2 - 1) * hueVariation * 360) % 360;
        saturation = Math.min(100, Math.max(0, saturation + (Math.random() * 2 - 1) * saturationVariation * 100));
        value = Math.min(100, Math.max(0, value + (Math.random() * 2 - 1) * valueVariation * 100));
        let newRHex = Math.round(value * 2.55 * (1 - saturation / 100) + (saturation / 100) * 255 * Math.cos(hue * Math.PI / 180));
        let newGHex = Math.round(value * 2.55 * (1 - saturation / 100) + (saturation / 100) * 255 * Math.cos((hue - 120) * Math.PI / 180));
        let newBHex = Math.round(value * 2.55 * (1 - saturation / 100) + (saturation / 100) * 255 * Math.cos((hue - 240) * Math.PI / 180));
        if (isNaN(newRHex)) newRHex = r;
        if (isNaN(newGHex)) newGHex = g;
        if (isNaN(newBHex)) newBHex = b;
        if (newRHex < 0) newRHex = 0;
        if (newGHex < 0) newGHex = 0;
        if (newBHex < 0) newBHex = 0;
        return `#${newRHex.toString(16).padStart(2, '0')}${newGHex.toString(16).padStart(2, '0')}${newBHex.toString(16).padStart(2, '0')}`;
    }
}

interface ParticleReaction {
    with: string; // The type of particle this reacts with
    result: string | null; // The resulting particle type after the reaction, or null to destroy both
    secondResult?: string | null; // Optional resulting particle type for the second particle, if not defined it will not produce another particle
    chance: number; // Chance of the reaction occurring (0-1)
    behavior?: (game: Powders, particle: Particle, otherParticle: Particle) => void; // Optional custom behavior for the reaction, if not defined it will just spawn the result particle at the location of the first particle
}

interface PowderType {
    name: string;
    color: string;
    colorVariation: number; // 0-1, how much the color can vary randomly
    behavior: (game: Powders, particle: Particle) => void;
    reverseGravity?: boolean; // Make it move up instead of down
    gasGravity?: boolean; // Makes gasses prefer to move with gravity instead of diffuse
    gasWeight?: number; // For gasses, how much they are affected by gravity if enabled (0-1)
    defaultTemp?: number; // Default temperature for the powder, used in interactions
    tempTransferRate?: number; // How quickly the particle transfers heat to adjacent particles, default is 0.1 (10% per tick)
    luminosity?: boolean; // Whether the particle "glows" or not.
    state: "solid" | "liquid" | "gas" | "energy" | "powder"; // For categorization, not used in behavior but can be used for interactions or future features.
    cliffable?: boolean; // Whether the particle can be used by platforming particles as a stable surface or not.
    reactions?: ParticleReaction[]; // List of reactions this particle can have with other particles
    meltingPoint?: number | null; // When does this melt/evaporate based on temperature (null for never).
    meltingResultSecond?: string | null; // Optional second result when melting, if not defined it will not produce another particle
    meltingResult?: string | null; // What does this turn into when it melts/evaporates, null for nothing (like steam disappearing)
    freezingPoint?: number | null; // When does this freeze based on temperature (null for never).
    freezingResult?: string | null; // What does this turn into when it freezes, null for nothing.
    freezingResultSecond?: string | null; // Optional second result when freezing, if not defined it will not produce another particle
    category: string | null; // Organizes the particle in UI categories, null to hide
    weight: number; // For future physics features, higher weight means it will swap with particles of lower weight more often. Default is 1.
    crushResult?: string | null; // What does this turn into when crushed, null for non-crushable.
}

function isStable(game: Powders, x: number, y: number): boolean {
    const particle = game.getParticle(x, y);
    if (!particle || particle.type === null) {
        return false;
    }
    const type = powderTypes.require(particle.type);
    if (!type.cliffable) {
        return false; // Not cliffable, so not stable.
    }
    switch (type.state) {
        case "solid":
            return true; // Solids are always stable
        case "liquid":
            const yMultiplier = type.reverseGravity ? -1 : 1;
            if (game.canSwap(powderTypes.getId(type)!, x, y + yMultiplier)) {
                return false; // Not stable if it can move in its gravity direction
            } else if (game.canSwap(powderTypes.getId(type)!, x - 1, y + yMultiplier) || game.canSwap(powderTypes.getId(type)!, x + 1, y + yMultiplier)) {
                return false; // Not stable if it can move diagonally in its gravity direction
            } else if (game.canSwap(powderTypes.getId(type)!, x - 1, y) || game.canSwap(powderTypes.getId(type)!, x + 1, y)) {
                return false; // Not stable if it can move horizontally
            }
            return true; // Stable if it can't move in any of its preferred directions
        case "gas":
            return false; // Gasses are never stable because they diffuse in all directions
        case "energy":
            return false; // Energy particles are never stable because they move in a direction and bounce off walls
        case "powder":
            // Same as liquid, but no horizontal check.
            const yMult = type.reverseGravity ? -1 : 1;
            if (game.canSwap(powderTypes.getId(type)!, x, y + yMult)) {
                return false; // Not stable if it can move in its gravity direction
            } else if (game.canSwap(powderTypes.getId(type)!, x - 1, y + yMult) || game.canSwap(powderTypes.getId(type)!, x + 1, y + yMult)) {
                return false; // Not stable if it can move diagonally in its gravity direction
            }
            return true; // Stable if it can't move in its preferred directions
        default:
            return false;
    }
}

const airTempTransferRate = 0.1; // How quickly particles transfer heat to the air and vice versa
let powderTypesInstanceMade = false;

function generateTypeButton(typeId: string, powders: Powders) {
    const type = powderTypes.require(typeId);
    const button = document.createElement("button");
    button.textContent = type.name;
    button.style.backgroundColor = type.color;
    button.classList.add("type-button");
    button.onclick = () => {
        powders.selectedType = typeId;
        powders.selectedTool = null; // Switch back to draw mode after selecting a type
    };
    return button;
}

const showHiddenTypes = new URLSearchParams(window.location.search).get("showHidden") === "true";

interface Tool {
    name: string;
    color: string;
    action: (game: Powders, x: number, y: number) => void; // Action, runs every frame/tick
    onTick: boolean; // Whether the action should run every tick or only on mouse events
}

class ToolTypes {
    registry: Map<string, Tool>;
    list: string[] = [];
    listElement: HTMLUListElement;

    constructor() {
        this.registry = new Map();
        this.listElement = document.getElementById("tools-list") as HTMLUListElement;
    }

    public register(id: string, tool: Tool) {
        this.registry.set(id, tool);
        this.list.push(id);
        const listItem = document.createElement("li");
        const content = document.createElement("button");
        content.textContent = tool.name;
        content.style.backgroundColor = tool.color;
        content.classList.add("type-button");
        content.onclick = () => {
            const game = getGame()!;
            console.log(`Selected tool: ${id}`);
            if (game.selectedTool === id) {
                game.selectedTool = null; // Deselect if clicking the same tool
            } else {
                game.selectedTool = id;
            }
            console.log(`Current selected tool: ${game.selectedTool}`);
        };
        listItem.appendChild(content);
        this.listElement.appendChild(listItem);
    }

    public get(id: string): Tool | undefined {
        return this.registry.get(id);
    }

    public require(id: string): Tool {
        const tool = this.registry.get(id);
        if (!tool) {
            throw new Error(`Tool "${id}" is not registered.`);
        }
        return tool;
    }

    public has(id: string): boolean {
        return this.registry.has(id);
    }
}

class PowderTypes {
    registry: Map<string, PowderType>;
    list: string[] = [];
    listElement: HTMLUListElement;
    pickerElement: HTMLDivElement;
    selectedCategory: string | null = null;
    categories: Map<string, HTMLDivElement> = new Map();
    static SAND = "sand"; // Regular sand.
    static STONE = "stone"; // Powder stone, not sand.
    static WATER = "water"; // Water/H2O.
    static BEDROCK = "bedrock"; // Solid version of stone.
    static STEAM = "steam"; // Gas version of water.
    static LASER = "laser"; // Energy particle that does nothing.

    constructor() {
        if (powderTypesInstanceMade) {
            throw new Error("PowderTypes is a singleton and cannot be instantiated more than once.");
        }
        powderTypesInstanceMade = true;
        this.registry = new Map();
        this.listElement = document.getElementById("categories-list") as HTMLUListElement;
        this.pickerElement = document.getElementById("category-display") as HTMLDivElement;
    }

    public register(id: string, type: PowderType) {
        if (showHiddenTypes && type.category === null) {
            type.category = "Hidden";
        }
        const newCategory = type.category && !this.categories.has(type.category);
        this.registry.set(id, type);
        this.list.push(id);
        let list: HTMLUListElement;
        if (newCategory) {
            const categoryElement = document.createElement("div");
            categoryElement.classList.add("category");
            categoryElement.id = `category-${type.category}`;
            const title = document.createElement("button");
            title.textContent = type.category;
            title.classList.add("text-button")
            title.classList.add("category-title");
            title.onclick = () => {
                if (this.selectedCategory === type.category) {
                    list.style.display = "none";
                    this.selectedCategory = null;
                } else {
                    // Hide previously selected category
                    if (this.selectedCategory) {
                        const prevCategoryList = document.getElementById(`category-list-${this.selectedCategory}`);
                        if (prevCategoryList) {
                            prevCategoryList.style.display = "none";
                        }
                    }
                    list.style.display = "block";
                    this.selectedCategory = type.category;
                }
            };
            const br = document.createElement("br");
            categoryElement.appendChild(title);
            categoryElement.appendChild(br);
            list = document.createElement("ul");
            list.id = `category-list-${type.category}`;
            list.classList.add("types-list");
            list.classList.add("category-type-list");
            list.style.display = "none"; // Start hidden until category is clicked
            list.style.flexWrap = "wrap";
            console.log(this.pickerElement);
            this.pickerElement.appendChild(list);
            this.categories.set(type.category!, categoryElement);
            this.listElement.appendChild(categoryElement);
        } else if (!type.category) {
            return; // Hidden.
        } else {
            list = document.getElementById(`category-list-${type.category}`)! as HTMLUListElement;
        }
        const listItem = document.createElement("li");
        const content = generateTypeButton(id, getGame()!);
        listItem.appendChild(content);
        list.appendChild(listItem);
    }

    public getId(type: PowderType): string | undefined {
        for (const [id, registeredType] of this.registry.entries()) {
            if (registeredType === type) {
                return id;
            }
        }
        return undefined;
    }

    public get(id: string): PowderType | undefined {
        return this.registry.get(id);
    }

    public require(id: string): PowderType {
        const type = this.registry.get(id);
        if (!type) {
            throw new Error(`Powder type "${id}" is not registered.`);
        }
        return type;
    }

    public has(id: string): boolean {
        return this.registry.has(id);
    }
}

export function n101random(lessZero: boolean = true): number {
    const rand = Math.random();

    if (lessZero) {
        // High Edges: 45% chance for -1, 45% chance for 1, 10% chance for 0
        if (rand < 0.45) return -1;
        if (rand < 0.55) return 0; // 0.1 wide "bucket" (10% chance)
        return 1;
    } else {
        // Equal 1/3 chance for each (33.3% per bucket)
        if (rand < 0.3333) return -1;
        if (rand < 0.6666) return 0;
        return 1;
    }
}



// Behavior function for powders (like sand or stone)
export function powderBehavior(game: Powders, particle: Particle, platforming?: number) {
    const type = powderTypes.require(particle.type!);
    const yMultiplier = type.reverseGravity ? -1 : 1;
    if (platforming && platforming > 0) {
        let cancel = false;
        // Check the left and right direction for a "stable" particle
        // Rightwards check
        for (let i = 1; i <= platforming; i++) {
            // Check left and right directions
            if (game.canSwap(particle.type, particle.x + i, particle.y) || !isStable(game, particle.x + i, particle.y)) {
                cancel = true; // Found a free or unstable space, so not stable in this direction
                break; // No stable particle to the right, stop checking
            } else {
                return; // Found a stable particle to the right, so this is stable and can be used for platforming
            }
        }
        if (!cancel) {
            // Leftwards check
            for (let i = 1; i <= platforming; i++) {
                if (game.canSwap(particle.type, particle.x - i, particle.y) || !isStable(game, particle.x - i, particle.y)) {
                    cancel = true; // Found a free or unstable space, so not stable in this direction
                    break; // No stable particle to the left, stop checking
                } else {
                    return; // Found a stable particle to the left, so this is stable and can be used for platforming
                }
            }
        }
    }
    // Try to move down (or up if reverseGravity)
    if (game.canSwap(particle.type, particle.x, particle.y + yMultiplier)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y + yMultiplier);
    } else {
        // Try to move down-left or down-right (or up-left/up-right if reverseGravity)
        const direction = n101random(); // Randomly choose left or right
        if (game.canSwap(particle.type, particle.x + direction, particle.y + yMultiplier)) {
            game.swapParticles(particle.x, particle.y, particle.x + direction, particle.y + yMultiplier);
        } else if (game.canSwap(particle.type, particle.x - direction, particle.y + yMultiplier)) {
            game.swapParticles(particle.x, particle.y, particle.x - direction, particle.y + yMultiplier);
        }
        // Unable to move otherwise, stays in place
    }
}

// Behavior function for liquids
export function liquidBehavior(game: Powders, particle: Particle) {
    const type = powderTypes.require(particle.type!);
    const yMultiplier = type.reverseGravity ? -1 : 1;
    // Try to move down (or up if reverseGravity)
    if (game.canSwap(particle.type, particle.x, particle.y + yMultiplier)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y + yMultiplier);
    } else {
        // Try to move down-left or down-right (or up-left/up-right if reverseGravity)
        const direction = n101random(); // Randomly choose left or right
        if (game.canSwap(particle.type, particle.x + direction, particle.y + yMultiplier)) {
            game.swapParticles(particle.x, particle.y, particle.x + direction, particle.y + yMultiplier);
        } else if (game.canSwap(particle.type, particle.x - direction, particle.y + yMultiplier)) {
            game.swapParticles(particle.x, particle.y, particle.x - direction, particle.y + yMultiplier);
        } else if (game.canSwap(particle.type, particle.x + direction, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x + direction, particle.y);
        } else if (game.canSwap(particle.type, particle.x - direction, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x - direction, particle.y);
        }
        // Unable to move otherwise, stays in place
    }
}

export function gasBehavior(game: Powders, particle: Particle) {
    const type = powderTypes.require(particle.type!);
    const gasGravityPref = type.gasGravity ? type.gasWeight || 0.5 : 0;
    const moveWithGravity = Math.random() < gasGravityPref;

    if (moveWithGravity) {
        // Do a simple liquid behavior if moving with gravity
        liquidBehavior(game, particle);
        return;
    } else {
        // Diffuse in a random direction.
        const directionX = n101random();
        const directionY = n101random();
        // BIG check for all 8 directions for diffusion, with a preference for chosen direction
        if (game.canSwap(particle.type, particle.x + directionX, particle.y + directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y + directionY);
        } else if (game.canSwap(particle.type, particle.x + directionX, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y);
        } else if (game.canSwap(particle.type, particle.x, particle.y + directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x, particle.y + directionY);
        } else if (game.canSwap(particle.type, particle.x - directionX, particle.y + directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y + directionY);
        } else if (game.canSwap(particle.type, particle.x - directionX, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y);
        } else if (game.canSwap(particle.type, particle.x, particle.y - directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x, particle.y - directionY);
        } else if (game.canSwap(particle.type, particle.x + directionX, particle.y - directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y - directionY);
        } else if (game.canSwap(particle.type, particle.x - directionX, particle.y - directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y - directionY);
        }
        // Unable to move otherwise, stays in place
    }
}

const cloudStartPercent = 0.0; // Start clouds around the top of the screen
const cloudEndPercent = 0.1; // End clouds around the top 10% of the screen

export function cloudBehavior(game: Powders, particle: Particle) {
    const cloudStartY = game.height * cloudStartPercent; // Start clouds around the top 0% of the screen
    const cloudEndY = game.height * cloudEndPercent; // End clouds around the top 10% of the screen

    // Diffuse in a random direction.
    const directionX = n101random();
    const directionY = particle.y > cloudEndY ? -1 : (particle.y < cloudStartY ? 1 : n101random()); // If below cloud area, prefer moving up. If above cloud area, prefer moving down. Otherwise, random.

    if (game.canSwap(particle.type, particle.x + directionX, particle.y + directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y + directionY);
    } else if (game.canSwap(particle.type, particle.x + directionX, particle.y)) {
        game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y);
    } else if (game.canSwap(particle.type, particle.x, particle.y + directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y + directionY);
    } else if (game.canSwap(particle.type, particle.x - directionX, particle.y + directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y + directionY);
    } else if (game.canSwap(particle.type, particle.x - directionX, particle.y)) {
        game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y);
    } else if (game.canSwap(particle.type, particle.x, particle.y - directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y - directionY);
    } else if (game.canSwap(particle.type, particle.x + directionX, particle.y - directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y - directionY);
    } else if (game.canSwap(particle.type, particle.x - directionX, particle.y - directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y - directionY);
    }
    // Unable to move otherwise, stays in place
}

export function solidBehavior(game: Powders, particle: Particle) {
    // Dont do anything :)
}

export function energyBehavior(game: Powders, particle: Particle) {
    // If no direction, pick a random one
    if (particle.directionX < 1 && particle.directionY < 1 && particle.directionX > -1 && particle.directionY > -1) {
        particle.directionX = n101random(false);
        particle.directionY = n101random(false);
    }
    // Move in the direction of energy
    const newX = particle.x + particle.directionX;
    const newY = particle.y + particle.directionY;
    if (game.isFree(newX, newY)) {
        game.swapParticles(particle.x, particle.y, newX, newY);
    } else {
        // Find new bounce direction based on the particle it hit
        const bouncedParticle = game.getParticle(newX, newY);
        if (bouncedParticle && bouncedParticle.directionX !== 0 && bouncedParticle.directionY !== 0) {
            // Use the direction of the particle we bounced on
            particle.directionX = -bouncedParticle.directionX;
            particle.directionY = -bouncedParticle.directionY;
        } else {
            // Calculate reflection direction from energy particle to bounced particle
            const dirX = newX - particle.x;
            const dirY = newY - particle.y;
            particle.directionX = -dirX;
            particle.directionY = -dirY;
        }
    }
}

export function staticEnergyBehavior(game: Powders, particle: Particle) {
    // Static energy rarely moves in a random direction, but can be moved by other particles like normal energy
    if (Math.random() < 0.05) { // 5% chance each tick to move in a random direction
        const directionX = n101random(false);
        const directionY = n101random(false);
        const newX = particle.x + directionX;
        const newY = particle.y + directionY;
        if (game.isFree(newX, newY)) {
            game.swapParticles(particle.x, particle.y, newX, newY);
        }
    }
}

export function colorCurve(points: { offset: number; color: string }[], position: number): string {
    position = 1 - Math.max(0, Math.min(1, position)); // Clamp position to [0, 1] and invert.
    // Sort points by offset
    points.sort((a, b) => a.offset - b.offset);
    // Find the two points we are between
    let startPoint = points[0];
    let endPoint = points[points.length - 1];
    for (let i = 0; i < points.length - 1; i++) {
        if (position >= points[i]!.offset && position <= points[i + 1]!.offset) {
            startPoint = points[i]!;
            endPoint = points[i + 1]!;
            break;
        }
    }
    // Calculate the ratio between the two points
    const range = endPoint!.offset - startPoint!.offset;
    const ratio = range === 0 ? 0 : (position - startPoint!.offset) / range;
    // Interpolate between the two colors
    const r1 = parseInt(startPoint!.color.slice(1, 3), 16);
    const g1 = parseInt(startPoint!.color.slice(3, 5), 16);
    const b1 = parseInt(startPoint!.color.slice(5, 7), 16);
    const r2 = parseInt(endPoint!.color.slice(1, 3), 16);
    const g2 = parseInt(endPoint!.color.slice(3, 5), 16);
    const b2 = parseInt(endPoint!.color.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export class Powders {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    grid: Particle[][];
    mouseX: number = 0;
    mouseY: number = 0;
    lastMouseX: number = 0;
    lastMouseY: number = 0;
    mouseLeftDown: boolean = false;
    mouseRightDown: boolean = false;
    selectedType: string | null = null;
    selectedTool: string | null = null;
    tickRate: number = 20; // 20 ticks per second
    tmpGrid: Particle[][] | null = null; // Temporary grid for updates
    paused: boolean = false;
    width: number = 75;
    height: number = 56;
    brushSize: number = 0; // 1 pixel
    intensifyBrush: boolean = false; // Intensification makes tools stronger.

    constructor() {
        console.log("Powders game initialized!");
        this.canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
        const context = this.canvas.getContext("2d");
        if (!context) {
            throw new Error("Failed to get 2D context");
        }
        this.ctx = context;
        this.grid = [];
        this.resize(this.canvas.width, this.canvas.height, false);
    }

    public isFree(x: number, y: number): boolean {
        return (
            y >= 0 &&
            y < this.grid.length &&
            x >= 0 &&
            x < this.grid[y]!.length &&
            this.grid[y]![x]!.type === null
        );
    }

    public canSwap(type: string | null, x: number, y: number): boolean {
        if (this.isFree(x, y)) {
            return true;
        }
        const otherParticle = this.getParticle(x, y);
        if (!otherParticle) {
            return false;
        }
        const otherType = powderTypes.require(otherParticle.type!);
        const thisType = type ? powderTypes.require(type) : null;
        return (thisType?.weight ?? 1) > otherType.weight;
    }

    public spawnParticle(x: number, y: number, type: string | null, replace: boolean = false) {
        if (x < 0 || y < 0 || y >= this.grid.length || x >= this.grid[y]!.length) {
            return; // Out of bounds
        }
        if (this.isFree(x, y) || replace) {
            (this.tmpGrid || this.grid)[y]![x] = new Particle(x, y, type);
        }
    }

    public removeParticle(x: number, y: number) {
        this.spawnParticle(x, y, null, true);
    }

    public listenInputs() {
        this.canvas.addEventListener("mousedown", (e) => {
            this.canvas.focus(); // Focus the canvas to receive keypress events
            if (e.button === 0) {
                this.mouseLeftDown = true;
            } else if (e.button === 2) {
                this.mouseRightDown = true;
            }
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = Math.floor((e.clientX - rect.left) / (rect.width / this.canvas.width));
            this.mouseY = Math.floor((e.clientY - rect.top) / (rect.height / this.canvas.height));
        });
        document.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
        this.canvas.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                this.mouseLeftDown = false;
            } else if (e.button === 2) {
                this.mouseRightDown = false;
            }
        });
        this.canvas.addEventListener("mousemove", (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = Math.floor((e.clientX - rect.left) / (rect.width / this.canvas.width));
            this.mouseY = Math.floor((e.clientY - rect.top) / (rect.height / this.canvas.height));
        });
        document.addEventListener("keydown", (e) => {
            switch (e.key) {
                case "d":
                    this.toggleDebug();
                    break;
                case "p":
                    this.paused = !this.paused;
                    break;
                case "f":
                    if (this.paused) {
                        this.update();
                    }
                    break;
                case "c":
                    this.resize(this.canvas.width, this.canvas.height, false);
                    break;
                case "=":
                    this.brushSize = Math.min(this.brushSize + 1, 10);
                    break;
                case "-":
                    this.brushSize = Math.max(this.brushSize - 1, 0);
                    break;
                case "Shift":
                    this.intensifyBrush = true;
                    break;
            }
        });
        document.addEventListener("keyup", (e) => {
            switch (e.key) {
                case "Shift":
                    this.intensifyBrush = false;
                    break;
            }
        });
    }

    public drawParticleRect(x: number, y: number, width: number, height: number, type: string | null, replace: boolean = false) {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                this.spawnParticle(x + dx, y + dy, type, replace);
            }
        }
    }

    public drawParticleLine(x1: number, y1: number, x2: number, y2: number, type: string | null, replace: boolean = false, width: number = 1) {
        width = (width * 2) + 1; // Fix any issues with size
        const dx = x2 - x1;
        const dy = y2 - y1;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        const offset = Math.floor(width / 2);
        if (steps === 0) {
            this.drawParticleRect(Math.round(x1) - offset, Math.round(y1) - offset, width, width, type, replace);
            return;
        }
        const stepX = dx / steps;
        const stepY = dy / steps;
        let prevX = Math.round(x1) - offset;
        let prevY = Math.round(y1) - offset;
        this.drawParticleRect(prevX, prevY, width, width, type, replace);
        for (let i = 1; i <= steps; i++) {
            const x = Math.round(x1 + stepX * i) - offset;
            const y = Math.round(y1 + stepY * i) - offset;
            // Draw intermediate points to prevent diagonal gaps
            if (x !== prevX || y !== prevY) {
                if (x !== prevX && y !== prevY) {
                    // For diagonal movement, draw both horizontal and vertical steps
                    this.drawParticleRect(x, prevY, width, width, type, replace);
                    this.drawParticleRect(prevX, y, width, width, type, replace);
                }
                this.drawParticleRect(x, y, width, width, type, replace);
                prevX = x;
                prevY = y;
            }
        }
    }

    public getAdjacentParticles(x: number, y: number): Particle[] {
        const adjacent: Particle[] = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip the center particle
                const adjParticle = this.getParticle(x + dx, y + dy);
                if (adjParticle) {
                    adjacent.push(adjParticle);
                }
            }
        }
        return adjacent;
    }

    public getAdjacentOfType(x: number, y: number, type: string): Particle | null {
        const adjacent = this.getAdjacentParticles(x, y).filter(p => p.type === type);
        return adjacent[0] ? adjacent[0] : null;
    }

    public swapParticles(x1: number, y1: number, x2: number, y2: number) {
        const temp = (this.tmpGrid || this.grid)[y1]![x1]!;
        (this.tmpGrid || this.grid)[y1]![x1] = (this.tmpGrid || this.grid)[y2]![x2]!;
        (this.tmpGrid || this.grid)[y2]![x2] = temp;
        // Make sure to update the particle's internal coordinates after swapping
        (this.tmpGrid || this.grid)[y1]![x1]!.x = x1;
        (this.tmpGrid || this.grid)[y1]![x1]!.y = y1;
        (this.tmpGrid || this.grid)[y2]![x2]!.x = x2;
        (this.tmpGrid || this.grid)[y2]![x2]!.y = y2;
    }

    public update() {
        this.tmpGrid = [];
        for (let y = 0; y < this.grid.length; y++) {
            const newRow: Particle[] = [];
            for (let x = 0; x < this.grid[y]!.length; x++) {
                const particle = this.grid[y]![x];
                if (particle && particle.type !== null) {
                    newRow.push(particle);
                } else {
                    newRow.push(new Particle(x, y, null));
                }
            }
            this.tmpGrid.push(newRow);
        }
        for (let y = this.grid.length - 1; y >= 0; y--) {
            for (let x = 0; x < this.grid[y]!.length; x++) {
                const particle = this.grid[y]![x];
                if (particle && particle.type !== null) {
                    const type = powderTypes.require(particle.type);
                    type.behavior(this, particle);
                    for (const reaction of type.reactions || []) {
                        if (Math.random() < reaction.chance) {
                            const otherParticle: Particle | null = this.getAdjacentOfType(particle.x, particle.y, reaction.with);
                            if (otherParticle) {
                                if (reaction.behavior) {
                                    reaction.behavior(this, particle, otherParticle);
                                } else {
                                    // Default reaction behavior: spawn result at the location of the first particle and destroy the second
                                    this.spawnParticle(particle.x, particle.y, reaction.result, true);
                                    if (reaction.secondResult) {
                                        this.spawnParticle(otherParticle.x, otherParticle.y, reaction.secondResult, true);
                                    }
                                    this.spawnParticle(otherParticle.x, otherParticle.y, null, true);
                                }
                            }
                        }
                    }
                    const adjacentParticles = this.getAdjacentParticles(particle.x, particle.y);
                    for (const adj of adjacentParticles) {
                        if (adj.type !== null) {
                            const tempDiff = particle.temp - adj.temp;
                            const transferAmount = tempDiff * (powderTypes.require(particle.type!).tempTransferRate || airTempTransferRate);
                            particle.temp -= transferAmount;
                            adj.temp += transferAmount;
                        }
                    }
                    if (adjacentParticles.length < 8) {
                        // If there are less than 8 adjacent particles, transfer some heat to the air (which is effectively a heat loss)
                        const tempDiff = particle.temp - 22; // Assuming air temp is 22 Celsius
                        const transferAmount = tempDiff * airTempTransferRate;
                        particle.temp -= transferAmount;
                    }
                    if (type.meltingPoint !== null && type.meltingPoint !== undefined && particle.temp >= type.meltingPoint) {
                        this.spawnParticle(particle.x, particle.y, type.meltingResult!, true);
                        if (type.meltingResultSecond) {
                            // Spawn second result in a random adjacent free space, or on top of the first result if no free space
                            const randomDirectionX = n101random(false);
                            const randomDirectionY = n101random(false);
                            if (this.isFree(particle.x + randomDirectionX, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y + randomDirectionY, type.meltingResultSecond, true);
                            } else if (this.isFree(particle.x - randomDirectionX, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y - randomDirectionY, type.meltingResultSecond, true);
                            } else if (this.isFree(particle.x + randomDirectionX, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y - randomDirectionY, type.meltingResultSecond, true);
                            } else if (this.isFree(particle.x - randomDirectionX, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y + randomDirectionY, type.meltingResultSecond, true);
                            } else if (this.isFree(particle.x + randomDirectionX, particle.y)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y, type.meltingResultSecond, true);
                            } else if (this.isFree(particle.x - randomDirectionX, particle.y)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y, type.meltingResultSecond, true);
                            } else if (this.isFree(particle.x, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x, particle.y + randomDirectionY, type.meltingResultSecond, true);
                            } else if (this.isFree(particle.x, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x, particle.y - randomDirectionY, type.meltingResultSecond, true);
                            } else {
                                this.spawnParticle(particle.x, particle.y, type.meltingResultSecond, true);
                            }
                        }
                    } else if (type.freezingPoint !== null && type.freezingPoint !== undefined && particle.temp <= type.freezingPoint) {
                        this.spawnParticle(particle.x, particle.y, type.freezingResult!, true);
                        if (type.freezingResultSecond) {
                            // Spawn second result in a random adjacent free space, or on top of the first result if no free space
                            const randomDirectionX = n101random(false);
                            const randomDirectionY = n101random(false);
                            if (this.isFree(particle.x + randomDirectionX, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y + randomDirectionY, type.freezingResultSecond, true);
                            } else if (this.isFree(particle.x - randomDirectionX, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y - randomDirectionY, type.freezingResultSecond, true);
                            } else if (this.isFree(particle.x + randomDirectionX, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y - randomDirectionY, type.freezingResultSecond, true);
                            } else if (this.isFree(particle.x - randomDirectionX, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y + randomDirectionY, type.freezingResultSecond, true);
                            } else if (this.isFree(particle.x + randomDirectionX, particle.y)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y, type.freezingResultSecond, true);
                            } else if (this.isFree(particle.x - randomDirectionX, particle.y)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y, type.freezingResultSecond, true);
                            } else if (this.isFree(particle.x, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x, particle.y + randomDirectionY, type.freezingResultSecond, true);
                            } else if (this.isFree(particle.x, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x, particle.y - randomDirectionY, type.freezingResultSecond, true);
                            } else {
                                this.spawnParticle(particle.x, particle.y, type.freezingResultSecond, true);
                            }
                        }
                    }
                }
            }
        }
        this.grid = this.tmpGrid;
        this.tmpGrid = null;
        this.updatePositions();
    }

    public toggleDebug() {
        const debugInfo = document.getElementById("debug-info")!;
        if (debugInfo.style.display === "none") {
            debugInfo.style.display = "block";
        } else {
            debugInfo.style.display = "none";
        }
    }

    public mouseDraw() {
        if (this.selectedTool === null) {
            if (!(this.mouseLeftDown || this.mouseRightDown) || !this.selectedType) {
                this.lastMouseX = this.mouseX;
                this.lastMouseY = this.mouseY;
            }
            if ((this.mouseLeftDown || this.mouseRightDown) && this.selectedType) {
                this.drawParticleLine(this.lastMouseX, this.lastMouseY, this.mouseX, this.mouseY, this.mouseRightDown ? null : this.selectedType, this.mouseRightDown, this.brushSize);
                this.lastMouseX = this.mouseX;
                this.lastMouseY = this.mouseY;
            }
        } else {
            this.lastMouseX = this.mouseX;
            this.lastMouseY = this.mouseY;
            const toolAction = toolTypes.require(this.selectedTool!).action;
            if (toolAction) {
                toolAction(this, this.mouseX, this.mouseY);
            }
        }
    }

    public getParticlesInCircle(centerX: number, centerY: number, radius: number): Particle[] {
        const particles: Particle[] = [];
        const radiusSquared = radius * radius;
        for (let y = Math.max(0, Math.floor(centerY - radius)); y <= Math.min(this.grid.length - 1, Math.ceil(centerY + radius)); y++) {
            for (let x = Math.max(0, Math.floor(centerX - radius)); x <= Math.min(this.grid[y]!.length - 1, Math.ceil(centerX + radius)); x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                if (dx * dx + dy * dy <= radiusSquared) {
                    const particle = this.getParticle(x, y);
                    if (particle) {
                        particles.push(particle);
                    }
                }
            }
        }
        return particles;
    }

    public getParticlesInSquare(x: number, y: number, width: number, height: number): Particle[] {
        const particles: Particle[] = [];
        if (width === 0 && height === 0) {
            const particle = this.getParticle(x, y);
            if (particle) {
                particles.push(particle);
            }
            return particles;
        }
        if (width === 0) {
            for (let j = Math.max(0, y); j < Math.min(this.grid.length, y + height); j++) {
                const particle = this.getParticle(x, j);
                if (particle) {
                    particles.push(particle);
                }
            }
            return particles;
        }
        if (height === 0) {
            for (let i = Math.max(0, x); i < Math.min(this.grid[0]!.length, x + width); i++) {
                const particle = this.getParticle(i, y);
                if (particle) {
                    particles.push(particle);
                }
            }
            return particles;
        }
        for (let j = Math.max(0, y); j < Math.min(this.grid.length, y + height); j++) {
            for (let i = Math.max(0, x); i < Math.min(this.grid[j]!.length, x + width); i++) {
                const particle = this.getParticle(i, j);
                if (particle) {
                    particles.push(particle);
                }
            }
        }
        return particles;
    }

    public render() {
        const toolData = this.selectedTool ? toolTypes.require(this.selectedTool) : null;
        if (toolData && !toolData.onTick) {
            this.mouseDraw();
        } else if (this.selectedTool === null) {
            this.mouseDraw(); // For drawing.
        }
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        let glows: { x: number; y: number; color: string }[] = [];
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y]!.length; x++) {
                const particle = this.grid[y]![x];
                if (particle && particle.type !== null) {
                    const type = powderTypes.require(particle.type);
                    // particle.deco ? particle.deco : type.color;
                    const drawColor = particle.deco ? particle.deco : type.color;;
                    if (type.luminosity) {
                        glows.push({ x, y, color: drawColor });
                    }
                    this.ctx.fillStyle = drawColor;
                    this.ctx.fillRect(x, y, 1, 1);
                } // Skip draw otherwise for better performance
            }
        }
        for (const glow of glows) {
            this.ctx.fillStyle = glow.color;
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillRect(glow.x - 1, glow.y, 1, 1);
            this.ctx.fillRect(glow.x + 1, glow.y, 1, 1);
            this.ctx.fillRect(glow.x, glow.y - 1, 1, 1);
            this.ctx.fillRect(glow.x, glow.y + 1, 1, 1);
            this.ctx.globalAlpha = 1.0;
        }
        // Debug info
        const mouseParticle = this.getParticle(this.mouseX, this.mouseY);
        const debugMousePos = document.getElementById("dbg-mouse-pos")!;
        debugMousePos.textContent = `${this.mouseX}, ${this.mouseY} (${mouseParticle?.type ?? "none"})`;
        const debugParticleInfo = document.getElementById("dbg-particle-info")!;
        debugParticleInfo.textContent = mouseParticle ? `Particle type: ${mouseParticle.type}, Particle deco: ${mouseParticle.deco ?? "none"}, Particle Temperature (Celsius): ${mouseParticle.temp ?? "N/A"}` : "No particle";
        this.ctx.fillStyle = "white";
        this.ctx.globalAlpha = 0.35;
        this.ctx.fillRect(this.mouseX - this.brushSize, this.mouseY - this.brushSize, this.brushSize * 2 + 1, this.brushSize * 2 + 1);
        this.ctx.globalAlpha = 1.0;
    }

    public getParticle(x: number, y: number): Particle | null {
        if (y >= 0 && y < this.grid.length && x >= 0 && x < this.grid[y]!.length) {
            return this.grid[y]![x]!;
        }
        return null;
    }

    public startGame() {
        console.log("Starting Powders game...");
        this.resize(this.canvas.width, this.canvas.height);
        this.listenInputs();
        const gameLoop = () => {
            if (!this.paused) {
                this.update();
                setTimeout(() => {
                    requestAnimationFrame(gameLoop);
                }, 1000 / this.tickRate);
            } else {
                requestAnimationFrame(gameLoop);
            }
        };
        const renderLoop = () => {
            this.render();
            requestAnimationFrame(renderLoop);
        }
        const toolTickLoop = () => {
            const toolData = this.selectedTool ? toolTypes.require(this.selectedTool) : null;
            if (toolData && toolData.onTick) {
                this.mouseDraw();
            }
            setTimeout(() => {
                requestAnimationFrame(toolTickLoop);
            }, 1000 / this.tickRate);
        }
        requestAnimationFrame(gameLoop);
        requestAnimationFrame(renderLoop);
        requestAnimationFrame(toolTickLoop);
    }

    public resize(width: number, height: number, generateTerrain: boolean = true) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this.grid = [];
        for (let y = 0; y < height; y++) {
            const row: Particle[] = [];
            for (let x = 0; x < width; x++) {
                row.push(new Particle(x, y, null));
            }
            this.grid.push(row);
        }
        if (generateTerrain) {
            this.generateSimpleTerrain();
        }
    }

    public updatePositions() {
        const newGrid: Particle[][] = [];
        for (let y = 0; y < this.grid.length; y++) {
            const newRow: Particle[] = [];
            for (let x = 0; x < this.grid[y]!.length; x++) {
                newRow.push(new Particle(x, y, null));
            }
            newGrid.push(newRow);
        }

        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y]!.length; x++) {
                const particle = this.grid[y]![x];
                if (particle && particle.type !== null) {
                    particle.x = particle.x;
                    particle.y = particle.y;
                    const newX = Math.max(0, Math.min(particle.x, newGrid[0]!.length - 1));
                    const newY = Math.max(0, Math.min(particle.y, newGrid.length - 1));
                    newGrid[newY]![newX] = particle;
                }
            }
        }

        this.grid = newGrid;
    }

    public crushParticle(x: number, y: number) {
        const particle = this.getParticle(x, y);
        if (particle && particle.type) {
            const type = powderTypes.require(particle.type);
            if (type.crushResult) {
                this.spawnParticle(x, y, type.crushResult, true);
            }
        }
    }

    public generateSimpleTerrain() {
        const bedrockHeight = this.canvas.height - 1; // Bedrock layer at the bottom
        const stoneHeight = this.canvas.height * (1 - 0.2); // Stone layer above bedrock
        const sandHeight = this.canvas.height * (1 - 0.3); // Sand layer above stone
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                if (y >= bedrockHeight) {
                    this.grid[y]![x] = new Particle(x, y, PowderTypes.BEDROCK);
                } else if (y >= stoneHeight) {
                    this.grid[y]![x] = new Particle(x, y, PowderTypes.STONE);
                }
                else if (y >= sandHeight) {
                    this.grid[y]![x] = new Particle(x, y, PowderTypes.SAND);
                }
            }
        }
    }
}

let game: Powders | null = null;

export function initPowders() {
    if (!game) {
        game = new Powders();
    }
}

export const powderTypes = new PowderTypes();
export const toolTypes = new ToolTypes();
initPowders();

export function startGame() {
    initPowders();
    game!.startGame();
    const button = document.getElementById("start-button")!;
    button.style.display = "none";
}

export function getGame(): Powders | null {
    return game;
}

powderTypes.register(PowderTypes.SAND, {
    name: "Sand",
    color: "#C2B280",
    colorVariation: 0.1,
    behavior: powderBehavior, // Normal sand behavior, no platforming
    defaultTemp: 22,
    tempTransferRate: 0.05,
    reactions: [
        {
            with: PowderTypes.WATER,
            result: "wetsand",
            chance: 0.5
        }
    ],
    meltingPoint: 1500, // When sand heats up to 1500C or above, it turns to lava
    meltingResult: "lava",
    state: "powder",
    category: "Powders",
    weight: 1
});
powderTypes.register("ice", {
    name: "Ice",
    color: "#99d9ea",
    colorVariation: 0.1,
    behavior: solidBehavior, // Does not move, but can be melted by heat or water
    defaultTemp: -15,
    tempTransferRate: 0.05,
    meltingPoint: 0, // When ice heats up to 0C or above, it turns to water
    meltingResult: PowderTypes.WATER,
    state: "solid",
    category: "Solids",
    weight: 0.5
});
powderTypes.register("snow", {
    name: "Snow",
    color: "#ffffff",
    colorVariation: 0.1,
    behavior: powderBehavior, // Snow :D
    defaultTemp: -15,
    tempTransferRate: 0.02, // Slower heat transfer because air.
    meltingPoint: 0, // When snow heats up to 0C or above, it turns to water
    meltingResult: PowderTypes.WATER,
    state: "powder",
    category: "Powders",
    weight: 0.2,
    crushResult: "ice", // When snow is crushed (like by a tool), it has a chance to turn into ice (compacted snow) instead of just being removed
});
powderTypes.register("dirtywater", {
    name: "Dirty Water",
    color: "#4B6F44",
    colorVariation: 0.1,
    behavior: liquidBehavior, // Similar to water but with impurities
    defaultTemp: 22,
    tempTransferRate: 0.05,
    reactions: [
        {
            with: PowderTypes.SAND,
            result: "wetsand",
            chance: 0.5,
            secondResult: "impurity" // When dirty water reacts with sand, it has a chance to create an impurity particle (like a small piece of dirt) in addition to wet sand
        }
    ],
    meltingPoint: 110, // When dirty water heats up to 110C or above, it turns to steam
    meltingResult: PowderTypes.STEAM,
    meltingResultSecond: "impurity", // When dirty water turns to steam, it has a chance to release an impurity particle (like a small piece of dirt)
    state: "liquid",
    category: "Fluids",
    freezingPoint: -10, // When dirty water cools down to -10C or below, it turns to ice (dirty water has a lower freezing point due to impurities)
    freezingResult: "ice",
    freezingResultSecond: "impurity", // When dirty water turns to ice, it has a chance to release an impurity particle (like a small piece of dirt)
    weight: 0.1, // Heavier than water (water is 0)
});
powderTypes.register("impurity", { // Junk particle.
    name: "Impurity",
    color: "#654321",
    colorVariation: 0.1,
    behavior: powderBehavior, // Does not move, just an impurity that can be created from certain reactions
    defaultTemp: 22,
    tempTransferRate: 0.01,
    state: "powder",
    category: "Powders",
    reactions: [
        {
            with: "water",
            result: "dirtywater",
            chance: 0.5
        }
    ],
    weight: 0.5, // Lighter than sand but heavier than water.
    crushResult: 
});
powderTypes.register("ash", {
    name: "Ash",
    color: "#555555",
    colorVariation: 0.1,
    behavior: powderBehavior, // Similar to sand but with a chance to be blown by wind (like smoke)
    defaultTemp: 22,
    tempTransferRate: 0.05,
    reactions: [
        {
            with: PowderTypes.WATER,
            result: "dirtywater",
            chance: 0.5
        }
    ],
    state: "powder",
    category: "Powders",
    weight: 0.3,
    crushResult: "dust", // Ash crushes into dust.
});
function falloutBehavior(game: Powders, particle: Particle) {
    powderBehavior(game, particle);
    // Emit radiation particles around the fallout
    if (Math.random() < 0.025) { // 2.5% chance each tick to emit radiation
        const directionX = n101random();
        const directionY = n101random();
        const distance = Math.floor(Math.random() * 2) + 1; // Emit radiation 1-2 particles away from the fallout
        if (game.isFree(particle.x + directionX * distance, particle.y + directionY * distance)) {
            game.spawnParticle(particle.x + directionX * distance, particle.y + directionY * distance, "radiation");
        }
    }
}
powderTypes.register("fallout", { // Similar to ash but heavier and emits radiation
    name: "Fallout",
    color: "#4f604d",
    colorVariation: 0.1,
    behavior: falloutBehavior, // Fallout from nuclear reactions, heavier than ash and emits radiation particles
    defaultTemp: 22,
    tempTransferRate: 0.05,
    reactions: [
        {
            with: PowderTypes.WATER,
            result: "dirtywater",
            chance: 0.5,
            secondResult: "radiation" // When fallout reacts with water, it has a chance to create a radiation particle in addition to dirty water
        }
    ],
    state: "powder",
    category: "Powders",
    weight: 0.4,
    crushResult: "radioactive_dust", // Fallout crushes into radioactive dust.
});
powderTypes.register("pyrocumulus", {
    name: "Pyrocumulus Cloud",
    color: "#2c211d",
    colorVariation: 0.1,
    behavior: (game: Powders, particle: Particle) => {
        cloudBehavior(game, particle);
        // Chance to spawn fire particles within the cloud
        if (Math.random() < 0.01) { // 1% chance each tick to spawn fire
            const directionX = n101random();
            const directionY = n101random();
            if (game.isFree(particle.x + directionX, particle.y + directionY)) {
                game.spawnParticle(particle.x + directionX, particle.y + directionY, "fire");
            }
        }
    }, // A type of cloud that forms from intense heat, with a chance to spawn fire particles within it (also drops ash)
    defaultTemp: 100,
    tempTransferRate: 0.1,
    reactions: [
        {
            with: "fire",
            result: "ash",
            chance: 0.5
        }
    ],
    state: "gas",
    category: "Gases",
    luminosity: true, // Apply the effect to make it look more diffuse
    weight: 0.2, // Lighter than regular clouds due to intense heat, so swaps with other clouds more easily to rise higher in the sky
});
powderTypes.register("cloud", {
    name: "Cloud",
    color: "#d2d8d8",
    colorVariation: 0.1,
    behavior: cloudBehavior,
    defaultTemp: 50,
    tempTransferRate: 0.05,
    state: "gas",
    freezingPoint: 20, // When cloud cools down to 20C or below, it turns to water for rain
    freezingResult: PowderTypes.WATER,
    meltingPoint: 120, // When cloud heats up to 120C or above, it turns to steam
    meltingResult: PowderTypes.STEAM,
    category: "Gases",
    luminosity: true, // Apply the effect to make it look more diffuse
    weight: 0.1 // Lighter than regular clouds
});
powderTypes.register("wetsand", {
    name: "Wet Sand",
    color: "#9E7B58",
    colorVariation: 0.1,
    behavior: (powder, particle) => powderBehavior(powder, particle, 1), // Can platform on wet sand up to 1 particle wide
    defaultTemp: 22,
    tempTransferRate: 0.1, // Transfers heat faster than regular sand because of the water content
    meltingPoint: 100, // When wet sand heats up to 100C or above, it turns back to regular sand
    meltingResult: PowderTypes.SAND,
    state: "powder",
    category: "Powders",
    weight: 1.5 // Heavier than regular sand due to water content
});
powderTypes.register("lava", {
    name: "Lava",
    color: "#ff4500",
    colorVariation: 0.1,
    behavior: liquidBehavior,
    defaultTemp: 1000,
    tempTransferRate: 0.2,
    luminosity: true,
    freezingPoint: 800, // When lava cools down to 800C or below, it turns to stone
    freezingResult: PowderTypes.STONE,
    state: "liquid",
    category: "Fluids",
    weight: 2 // Heavier than water
});
powderTypes.register(PowderTypes.STONE, {
    name: "Stone",
    color: "#808080",
    colorVariation: 0.05,
    behavior: (game, particle) => powderBehavior(game, particle, 2), // Can platform on stone up to 2 particles wide
    defaultTemp: 22,
    tempTransferRate: 0.02,
    cliffable: true,
    meltingPoint: 1500, // When stone heats up to 1500C or above, it turns to lava
    meltingResult: "lava",
    state: "powder",
    category: "Powders",
    weight: 2, // Heavier than sand, same weight as lava for magma.
    crushResult: "gravel", // When stone is crushed (like by a tool), it has a chance to turn into gravel instead of just being removed
});
powderTypes.register("gravel", {
    name: "Gravel",
    color: "#606060",
    colorVariation: 0.2,
    behavior: powderBehavior, // Similar to sand but with a chance to be blown by wind (like smoke)
    crushResult: "sand", // When gravel is crushed, it turns into sand
    state: "powder",
    category: "Powders",
    weight: 1.2, // Heavier than sand but lighter than stone
});
powderTypes.register(PowderTypes.WATER, {
    name: "Water",
    color: "#006eff",
    colorVariation: 0.1,
    behavior: liquidBehavior,
    defaultTemp: 22,
    tempTransferRate: 0.1,
    cliffable: false,
    meltingPoint: 100, // When water heats up to 100C or above, it turns to steam
    meltingResult: PowderTypes.STEAM,
    state: "liquid",
    category: "Fluids",
    freezingPoint: 0, // When water cools down to 0C or below, it turns to ice
    freezingResult: "ice",
    weight: 0 // Waters weight
});
powderTypes.register(PowderTypes.BEDROCK, {
    name: "Bedrock",
    color: "#4B4B4B",
    colorVariation: 0.02,
    behavior: solidBehavior,
    defaultTemp: 22,
    tempTransferRate: 0.01,
    cliffable: true,
    meltingPoint: 2500, // When bedrock heats up to 2500C or above, it turns to lava
    meltingResult: "lava",
    state: "solid",
    category: "Solids",
    weight: 5, // Heaviest material in the game
    crushResult: "stone", // Bedrock becomes stone when crushed.
});
// Indestructible wall that cannot transfer heat for building
powderTypes.register("wall", {
    name: "Wall",
    color: "#333333",
    colorVariation: 0.02,
    behavior: solidBehavior,
    defaultTemp: 22,
    tempTransferRate: 0.0,
    cliffable: true,
    state: "solid",
    category: "Special",
    weight: 9999, // Effectively immovable
    crushResult: null, // Wall cannot be crushed
});
powderTypes.register(PowderTypes.STEAM, {
    name: "Steam",
    color: "#B0E0E6",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        gasBehavior(game, particle);
        // Chance to become cloud if it rises high enough
        if (Math.random() < 0.01) { // 1% chance each tick to spawn cloud
            if (particle.y < game.height * cloudEndPercent && particle.y > game.height * cloudStartPercent) {
                game.spawnParticle(particle.x, particle.y, "cloud", true);
            }
        }
    },
    reverseGravity: true,
    gasGravity: true,
    gasWeight: 0.3,
    defaultTemp: 120,
    tempTransferRate: 0.15,
    freezingPoint: 100, // When steam cools down to 100C or below, it turns to water
    freezingResult: PowderTypes.WATER,
    state: "gas",
    category: "Gases",
    luminosity: true, // Apply the effect to make it look more diffuse
    weight: -0.1 // Lighter than water
});
powderTypes.register(PowderTypes.LASER, {
    name: "Laser",
    color: "#FF0000",
    colorVariation: 0.0,
    behavior: energyBehavior,
    defaultTemp: 1000,
    tempTransferRate: 0.5,
    luminosity: true,
    state: "energy",
    category: "Energy",
    weight: -1, // Energy has no weight.
});
powderTypes.register("smoke", {
    name: "Smoke",
    color: "#555555",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        gasBehavior(game, particle);
        // Chance to spawn ash particles within the smoke
        if (Math.random() < 0.005) { // 0.5% chance each tick to become ash
            game.spawnParticle(particle.x, particle.y, "ash", true);
        }
        if (Math.random() < 0.01) { // 1% chance each tick to become a pyrocumulus cloud if high enough.
            if (particle.y < game.height * cloudEndPercent && particle.y > game.height * cloudStartPercent) {
                game.spawnParticle(particle.x, particle.y, "pyrocumulus", true);
            }
        }
    },
    reverseGravity: true,
    gasGravity: true,
    gasWeight: 0.2,
    defaultTemp: 80,
    tempTransferRate: 0.1,
    freezingPoint: 20, // When smoke cools down to 20C or below, it dissipates (turns to air)
    freezingResult: null,
    state: "gas",
    category: "Gases",
    luminosity: true, // Apply the effect to make it look more diffuse
    weight: 0.1 // Lighter than regular clouds
});
powderTypes.register("fire", {
    name: "Fire",
    color: "#ffb300",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        // Try to move upwards with some randomness
        const directionX = n101random(false);
        const directionY = -1; // Always try to move up
        if (game.canSwap("fire", particle.x + directionX, particle.y + directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y + directionY);
        } else if (game.canSwap("fire", particle.x, particle.y + directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x, particle.y + directionY);
        } else if (game.canSwap("fire", particle.x + directionX, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y);
        }
        const startColor = powderTypes.require("fire").color;
        const endColor = powderTypes.require("smoke").color; // Fire turns to smoke (black) as it cools
        const startTemp = powderTypes.require("fire").defaultTemp!;
        const endTemp = powderTypes.require("smoke").defaultTemp!;
        const tempRatio = Math.max(0, Math.min(1, (particle.temp - endTemp) / (startTemp - endTemp)));
        particle.deco = colorCurve(
            [
                { offset: 0, color: startColor },
                { offset: 0.25, color: "#ff8000" },
                { offset: 0.75, color: "#FF0000" },
                { offset: 1, color: endColor },
            ],
            tempRatio
        );
    },
    defaultTemp: 600,
    tempTransferRate: 0.3,
    luminosity: true,
    freezingPoint: 80, // When fire cools down to 80C or below, it turns to smoke
    freezingResult: "smoke",
    state: "gas",
    category: "Energy",
    weight: -0.2 // Lighter than steam
});
powderTypes.register("radiation", { // Generic radiation particle, does pretty much nothing
    name: "Radiation",
    color: "#00ff00",
    colorVariation: 0.25,
    behavior: (game: Powders, particle: Particle) => {
        staticEnergyBehavior(game, particle);
        if (Math.random() < 0.01) { // 1% chance each tick to vanish
            game.removeParticle(particle.x, particle.y);
        }
    },
    defaultTemp: 0,
    tempTransferRate: 0,
    luminosity: true,
    state: "energy",
    category: "Energy",
    weight: -1, // Energy has no weight.
});
powderTypes.register("crusher", {
    name: "Crusher",
    color: "#888888",
    colorVariation: 0.2,
    behavior: (game: Powders, particle: Particle) => {
        const adajcentParticles = game.getAdjacentParticles(particle.x, particle.y);
        for (const adjacent of adajcentParticles) {
            game.crushParticle(adjacent.x, adjacent.y);
        }
        particle.deco = particle.generateColorVariation()
    },
    defaultTemp: 22,
    tempTransferRate: 0.01,
    state: "solid",
    category: "Special",
    weight: 9999, // Effectively immovable
    crushResult: null, // Crusher cannot be crushed
});
powderTypes.register("dust", {
    name: "Dust",
    color: "#aaaaaa",
    colorVariation: 0.2,
    behavior: powderBehavior,
    defaultTemp: 22,
    tempTransferRate: 0.01,
    state: "solid",
    category: "Special",
    weight: -0.9, // Super light, most gases can swap with it, making it rise.
    crushResult: null, // Dust cannot be crushed
});
// Same as regular dust, but with the properties of fallout
powderTypes.register("radioactive_dust", {
    name: "Radioactive Dust",
    color: "#8dad8d",
    colorVariation: 0.2,
    behavior: falloutBehavior,
    defaultTemp: 22,
    tempTransferRate: 0.01,
    state: "solid",
    category: "Special",
    weight: -0.9, // Super light, most gases can swap with it, making it rise.
    crushResult: null, // Dust cannot be crushed
});
toolTypes.register("heat", {
    name: "Heat Tool",
    color: "#ff0000",
    action: (game, x, y) => {
        if (!game.mouseLeftDown) return;
        const halfBrushSize = Math.floor(game.brushSize / 2);
        const particles = game.getParticlesInSquare(x - halfBrushSize, y - halfBrushSize, game.brushSize, game.brushSize);
        for (const particle of particles) {
            particle.temp += game.intensifyBrush ? 20 : 10; // Increase temperature by 10 degrees Celsius per tick
        }
    },
    onTick: true,
});
toolTypes.register("cool", {
    name: "Cool Tool",
    color: "#0000ff",
    action: (game, x, y) => {
        if (!game.mouseLeftDown) return;
        const halfBrushSize = Math.floor(game.brushSize / 2);
        const particles = game.getParticlesInSquare(x - halfBrushSize, y - halfBrushSize, game.brushSize, game.brushSize);
        for (const particle of particles) {
            particle.temp -= game.intensifyBrush ? 20 : 10; // Decrease temperature.
        }
    },
    onTick: true
});
toolTypes.register("eyedropper", {
    name: "Pick Tool",
    color: "#ffffff",
    action: (game, x, y) => {
        if (!game.mouseLeftDown) return; // Only pick when left mouse button is held down
        const particle = game.getParticle(x, y);
        if (particle) {
            game.selectedType = particle.type;
        }
        game.selectedTool = null; // Switch back to draw mode after picking
    },
    onTick: false
});
toolTypes.register("mix", {
    name: "Mix Tool",
    color: "#00ff00",
    action: (game, x, y) => {
        if (!game.mouseLeftDown) return;
        const particles = game.getParticlesInSquare(x - game.brushSize, y - game.brushSize, (game.brushSize * 2) + 1, (game.brushSize * 2) + 1);
        const cycles = game.intensifyBrush ? 4 : 2; // Number of times to apply mixing per tick
        for (let i = 0; i < cycles; i++) {
            for (let j = 0; j < particles.length; j++) {
                const pair1 = particles[j];
                const pair2 = particles[Math.floor(Math.random() * particles.length)];
                if (pair1 && pair2 && pair1 !== pair2) {
                    game.swapParticles(pair1.x, pair1.y, pair2.x, pair2.y);
                }
            }
        }
    },
    onTick: true
});
toolTypes.register("crush", {
    name: "Crush Tool",
    color: "#b8b36d",
    action: (game, x, y) => {
        if (!game.mouseLeftDown) return;
        const particles = game.getParticlesInSquare(x - game.brushSize, y - game.brushSize, (game.brushSize * 2) + 1, (game.brushSize * 2) + 1);
        for (const particle of particles) {
            game.crushParticle(particle.x, particle.y);
        }
    },
    onTick: true
});

export default {
    startGame,
    getGame,
    Powders,
    Particle
};
