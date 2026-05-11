export class Particle {
    x;
    y;
    type;
    directionX; // Direction X for energy
    directionY; // Direction Y for energy
    deco; // For visual variations, like different sand colors
    temp; // For temperature-based interactions
    bvs1 = 0; // Shared Behavior Value 1, not affected by game, only behaviors
    bvs2 = 0; // Shared Behavior Value 2, not affected by game, only behaviors
    bvs3 = 0; // Shared Behavior Value 3, not affected by game, only behaviors
    bvs4 = 0; // Shared Behavior Value 4, not affected by game, only behaviors
    bvs5 = 0; // Shared Behavior Value 5, not affected by game, only behaviors
    life = 0; // For aging particles, not affected by game, only behaviors
    onFire = false; // Whether this particle is currently on fire or not
    constructor(x, y, type, directionX = 0, directionY = 0) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.directionX = directionX;
        this.directionY = directionY;
        if (type) {
            const powderType = powderTypes.require(type);
            this.temp = powderType.defaultTemp ?? 22;
        }
        else {
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
    generateColorVariation() {
        // Simple color variation by adjusting the HSV values randomly within the variation range
        const type = powderTypes.require(this.type);
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
        if (isNaN(newRHex))
            newRHex = r;
        if (isNaN(newGHex))
            newGHex = g;
        if (isNaN(newBHex))
            newBHex = b;
        if (newRHex < 0)
            newRHex = 0;
        if (newGHex < 0)
            newGHex = 0;
        if (newBHex < 0)
            newBHex = 0;
        return `#${newRHex.toString(16).padStart(2, '0')}${newGHex.toString(16).padStart(2, '0')}${newBHex.toString(16).padStart(2, '0')}`;
    }
    lightOnFire() {
        if (!this.onFire) {
            this.onFire = true;
        }
    }
}
function isStable(game, x, y) {
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
            if (game.canSwap(powderTypes.getId(type), x, y + yMultiplier)) {
                return false; // Not stable if it can move in its gravity direction
            }
            else if (game.canSwap(powderTypes.getId(type), x - 1, y + yMultiplier) || game.canSwap(powderTypes.getId(type), x + 1, y + yMultiplier)) {
                return false; // Not stable if it can move diagonally in its gravity direction
            }
            else if (game.canSwap(powderTypes.getId(type), x - 1, y) || game.canSwap(powderTypes.getId(type), x + 1, y)) {
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
            if (game.canSwap(powderTypes.getId(type), x, y + yMult)) {
                return false; // Not stable if it can move in its gravity direction
            }
            else if (game.canSwap(powderTypes.getId(type), x - 1, y + yMult) || game.canSwap(powderTypes.getId(type), x + 1, y + yMult)) {
                return false; // Not stable if it can move diagonally in its gravity direction
            }
            return true; // Stable if it can't move in its preferred directions
        default:
            return false;
    }
}
const airTempTransferRate = 0.1; // How quickly particles transfer heat to the air and vice versa
let powderTypesInstanceMade = false;
function generateTypeButton(typeId, powders) {
    const type = powderTypes.require(typeId);
    const button = document.createElement("button");
    button.textContent = type.name;
    button.style.backgroundColor = type.color;
    if (blackContrastText(type.color)) {
        button.style.color = "#000000"; // Switch to black text for white elements for visibility
    }
    button.classList.add("type-button");
    button.onclick = () => {
        powders.selectedType = typeId;
        powders.selectedTool = null; // Switch back to draw mode after selecting a type
    };
    return button;
}
const showHiddenTypes = new URLSearchParams(window.location.search).get("showHidden") === "true";
function blackContrastText(color) {
    // Parse hex color to RGB
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate luminance using relative luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Return true if background is light (use black text), false if dark (use white text)
    return luminance > 0.5;
}
class ToolTypes {
    registry;
    list = [];
    listElement;
    constructor() {
        this.registry = new Map();
        this.listElement = document.getElementById("tools-list");
    }
    register(id, tool) {
        this.registry.set(id, tool);
        this.list.push(id);
        const listItem = document.createElement("li");
        const content = document.createElement("button");
        content.textContent = tool.name;
        content.style.backgroundColor = tool.color;
        if (blackContrastText(tool.color)) {
            content.style.color = "#000000"; // Switch to black text for white tools for visibility
        }
        content.classList.add("type-button");
        content.onclick = () => {
            const game = getGame();
            console.log(`Selected tool: ${id}`);
            if (game.selectedTool === id) {
                game.selectedTool = null; // Deselect if clicking the same tool
            }
            else {
                game.selectedTool = id;
            }
            console.log(`Current selected tool: ${game.selectedTool}`);
        };
        listItem.appendChild(content);
        this.listElement.appendChild(listItem);
    }
    get(id) {
        return this.registry.get(id);
    }
    require(id) {
        const tool = this.registry.get(id);
        if (!tool) {
            throw new Error(`Tool "${id}" is not registered.`);
        }
        return tool;
    }
    has(id) {
        return this.registry.has(id);
    }
}
class PowderTypes {
    registry;
    list = [];
    listElement;
    pickerElement;
    selectedCategory = null;
    categories = new Map();
    tags = new Map(); // For tagging elements.
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
        this.listElement = document.getElementById("categories-list");
        this.pickerElement = document.getElementById("category-display");
        this.tags.set("all", new Set());
    }
    addToTag(id, tag, strict = false) {
        if (!this.tagExists(tag)) {
            if (strict) {
                throw new Error(`Tag "${tag}" does not exist.`);
            }
            this.tags.set(tag, new Set());
        }
        this.tags.get(tag).add(id);
    }
    registerTag(tag) {
        if (this.tagExists(tag)) {
            throw new Error(`Tag "${tag}" already exists.`);
        }
        this.tags.set(tag, new Set());
    }
    getTag(tag) {
        return this.tags.get(tag);
    }
    isTagged(id, tag) {
        return this.getAllWithTagId(tag).includes(id);
    }
    // Avoid ALL circular references!
    getAllWithTag(tag, previousTagsSearched = new Set()) {
        const ids = this.getTag(tag);
        if (ids === undefined) {
            throw new Error(`Tag "${tag}" does not exist.`);
        }
        if (ids.size === 0) {
            return []; // Tag has nothing, dont even bother
        }
        const types = [];
        for (const id of ids) {
            if (id.startsWith("#")) {
                const nestedTag = id.substring(1);
                if (nestedTag === tag) {
                    throw new Error(`Circular tag reference detected for tag "${tag}".`);
                }
                if (previousTagsSearched.has(nestedTag)) {
                    throw new Error(`Circular tag reference detected between tags "${tag}" and "${nestedTag}".`);
                }
                const nestedTypes = this.getAllWithTag(nestedTag, new Set(previousTagsSearched).add(tag));
                types.push(...nestedTypes);
            }
            else {
                const type = this.get(id);
                if (type) {
                    types.push(type);
                }
            }
        }
        return types;
    }
    getAllWithTagId(tag) {
        const types = this.getAllWithTag(tag);
        return types.map(type => this.getId(type)).filter(id => id !== undefined);
    }
    tagExists(tag) {
        return this.tags.has(tag);
    }
    randomFromTag(tag) {
        const types = this.getAllWithTag(tag);
        if (types.length === 0) {
            throw new Error(`No powder types found for tag "${tag}".`);
        }
        const randomIndex = Math.floor(Math.random() * types.length);
        return types[randomIndex];
    }
    register(id, type) {
        if (showHiddenTypes && type.category === null) {
            type.category = "Hidden";
        }
        const newCategory = type.category && !this.categories.has(type.category);
        this.registry.set(id, type);
        this.list.push(id);
        this.tags.get("all").add(id);
        let list;
        if (newCategory) {
            const categoryElement = document.createElement("div");
            categoryElement.classList.add("category");
            categoryElement.id = `category-${type.category}`;
            const title = document.createElement("button");
            title.textContent = type.category;
            title.classList.add("text-button");
            title.classList.add("category-title");
            title.onclick = () => {
                if (this.selectedCategory === type.category) {
                    list.style.display = "none";
                    this.selectedCategory = null;
                }
                else {
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
            list.classList.add("category-types-list");
            list.style.display = "none"; // Start hidden until category is clicked
            list.style.flexWrap = "wrap";
            console.log(this.pickerElement);
            this.pickerElement.appendChild(list);
            this.categories.set(type.category, categoryElement);
            this.listElement.appendChild(categoryElement);
        }
        else if (!type.category) {
            return; // Hidden.
        }
        else {
            list = document.getElementById(`category-list-${type.category}`);
        }
        const listItem = document.createElement("li");
        const content = generateTypeButton(id, getGame());
        listItem.appendChild(content);
        list.appendChild(listItem);
    }
    getId(type) {
        for (const [id, registeredType] of this.registry.entries()) {
            if (registeredType === type) {
                return id;
            }
        }
        return undefined;
    }
    get(id) {
        return this.registry.get(id);
    }
    require(id) {
        const type = this.registry.get(id);
        if (!type) {
            throw new Error(`Powder type "${id}" is not registered.`);
        }
        return type;
    }
    has(id) {
        return this.registry.has(id);
    }
}
export function n101random(lessZero = true) {
    const rand = Math.random();
    if (lessZero) {
        // High Edges: 45% chance for -1, 45% chance for 1, 10% chance for 0
        if (rand < 0.45)
            return -1;
        if (rand < 0.55)
            return 0; // 0.1 wide "bucket" (10% chance)
        return 1;
    }
    else {
        // Equal 1/3 chance for each (33.3% per bucket)
        if (rand < 0.3333)
            return -1;
        if (rand < 0.6666)
            return 0;
        return 1;
    }
}
// Behavior function for powders (like sand or stone)
export function powderBehavior(game, particle, platforming) {
    const type = powderTypes.require(particle.type);
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
            }
            else {
                return; // Found a stable particle to the right, so this is stable and can be used for platforming
            }
        }
        if (!cancel) {
            // Leftwards check
            for (let i = 1; i <= platforming; i++) {
                if (game.canSwap(particle.type, particle.x - i, particle.y) || !isStable(game, particle.x - i, particle.y)) {
                    cancel = true; // Found a free or unstable space, so not stable in this direction
                    break; // No stable particle to the left, stop checking
                }
                else {
                    return; // Found a stable particle to the left, so this is stable and can be used for platforming
                }
            }
        }
    }
    // Try to move down (or up if reverseGravity)
    if (game.canSwap(particle.type, particle.x, particle.y + yMultiplier)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y + yMultiplier);
    }
    else {
        // Try to move down-left or down-right (or up-left/up-right if reverseGravity)
        const direction = n101random(); // Randomly choose left or right
        if (game.canSwap(particle.type, particle.x + direction, particle.y + yMultiplier)) {
            game.swapParticles(particle.x, particle.y, particle.x + direction, particle.y + yMultiplier);
        }
        else if (game.canSwap(particle.type, particle.x - direction, particle.y + yMultiplier)) {
            game.swapParticles(particle.x, particle.y, particle.x - direction, particle.y + yMultiplier);
        }
        // Unable to move otherwise, stays in place
    }
}
// Behavior function for liquids
export function liquidBehavior(game, particle) {
    const type = powderTypes.require(particle.type);
    const yMultiplier = type.reverseGravity ? -1 : 1;
    // Try to move down (or up if reverseGravity)
    if (game.canSwap(particle.type, particle.x, particle.y + yMultiplier)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y + yMultiplier);
    }
    else {
        // Try to move down-left or down-right (or up-left/up-right if reverseGravity)
        const direction = n101random(); // Randomly choose left or right
        if (game.canSwap(particle.type, particle.x + direction, particle.y + yMultiplier)) {
            game.swapParticles(particle.x, particle.y, particle.x + direction, particle.y + yMultiplier);
        }
        else if (game.canSwap(particle.type, particle.x - direction, particle.y + yMultiplier)) {
            game.swapParticles(particle.x, particle.y, particle.x - direction, particle.y + yMultiplier);
        }
        else if (game.canSwap(particle.type, particle.x + direction, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x + direction, particle.y);
        }
        else if (game.canSwap(particle.type, particle.x - direction, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x - direction, particle.y);
        }
        // Unable to move otherwise, stays in place
    }
}
export function gasBehavior(game, particle) {
    const type = powderTypes.require(particle.type);
    const gasGravityPref = type.gasGravity ? type.gasWeight || 0.5 : 0;
    const moveWithGravity = Math.random() < gasGravityPref;
    if (moveWithGravity) {
        // Do a simple liquid behavior if moving with gravity
        liquidBehavior(game, particle);
        return;
    }
    else {
        // Diffuse in a random direction.
        const directionX = n101random();
        const directionY = n101random();
        // BIG check for all 8 directions for diffusion, with a preference for chosen direction
        if (game.canSwap(particle.type, particle.x + directionX, particle.y + directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y + directionY);
        }
        else if (game.canSwap(particle.type, particle.x + directionX, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y);
        }
        else if (game.canSwap(particle.type, particle.x, particle.y + directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x, particle.y + directionY);
        }
        else if (game.canSwap(particle.type, particle.x - directionX, particle.y + directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y + directionY);
        }
        else if (game.canSwap(particle.type, particle.x - directionX, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y);
        }
        else if (game.canSwap(particle.type, particle.x, particle.y - directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x, particle.y - directionY);
        }
        else if (game.canSwap(particle.type, particle.x + directionX, particle.y - directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y - directionY);
        }
        else if (game.canSwap(particle.type, particle.x - directionX, particle.y - directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y - directionY);
        }
        // Unable to move otherwise, stays in place
    }
}
const cloudStartPercent = 0.0; // Start clouds around the top of the screen
const cloudEndPercent = 0.1; // End clouds around the top 10% of the screen
export function cloudBehavior(game, particle) {
    const cloudStartY = game.height * cloudStartPercent; // Start clouds around the top 0% of the screen
    const cloudEndY = game.height * cloudEndPercent; // End clouds around the top 10% of the screen
    // Diffuse in a random direction.
    const directionX = n101random();
    const directionY = particle.y > cloudEndY ? -1 : (particle.y < cloudStartY ? 1 : n101random()); // If below cloud area, prefer moving up. If above cloud area, prefer moving down. Otherwise, random.
    if (game.canSwap(particle.type, particle.x + directionX, particle.y + directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y + directionY);
    }
    else if (game.canSwap(particle.type, particle.x + directionX, particle.y)) {
        game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y);
    }
    else if (game.canSwap(particle.type, particle.x, particle.y + directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y + directionY);
    }
    else if (game.canSwap(particle.type, particle.x - directionX, particle.y + directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y + directionY);
    }
    else if (game.canSwap(particle.type, particle.x - directionX, particle.y)) {
        game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y);
    }
    else if (game.canSwap(particle.type, particle.x, particle.y - directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y - directionY);
    }
    else if (game.canSwap(particle.type, particle.x + directionX, particle.y - directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y - directionY);
    }
    else if (game.canSwap(particle.type, particle.x - directionX, particle.y - directionY)) {
        game.swapParticles(particle.x, particle.y, particle.x - directionX, particle.y - directionY);
    }
    // Unable to move otherwise, stays in place
}
export function solidBehavior(game, particle) {
    // Dont do anything :)
}
export function energyBehavior(game, particle) {
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
    }
    else {
        // Calculate surface normal by checking which direction is blocked
        let normalX = 0;
        let normalY = 0;
        // Determine the normal of the surface hit
        const blockedX = !game.isFree(particle.x + particle.directionX, particle.y);
        const blockedY = !game.isFree(particle.x, particle.y + particle.directionY);
        // Set normal based on which axis is blocked
        if (blockedX)
            normalX = -Math.sign(particle.directionX);
        if (blockedY)
            normalY = -Math.sign(particle.directionY);
        // If we couldn't determine normal, fallback to simple reversal
        if (normalX === 0 && normalY === 0) {
            normalX = -Math.sign(particle.directionX) || 0;
            normalY = -Math.sign(particle.directionY) || 0;
        }
        // Reflect velocity: r = d - 2(d·n)n
        const dotProduct = particle.directionX * normalX + particle.directionY * normalY;
        particle.directionX = particle.directionX - 2 * dotProduct * normalX;
        particle.directionY = particle.directionY - 2 * dotProduct * normalY;
        // // Add slight randomness for realistic material variation
        // particle.directionX += (Math.random() - 0.5) * 0.2;
        // particle.directionY += (Math.random() - 0.5) * 0.2;
        // Ensure we have a valid direction after bounce to prevent freezing
        if (Math.abs(particle.directionX) < 0.1 && Math.abs(particle.directionY) < 0.1) {
            particle.directionX = n101random(false);
            particle.directionY = n101random(false);
        }
        // Try to move in reflected direction, with fallback to adjacent directions
        let moveFound = false;
        const checkX = particle.x + particle.directionX;
        const checkY = particle.y + particle.directionY;
        if (game.isFree(checkX, checkY)) {
            moveFound = true;
        }
        else {
            // Try all 8 directions to find an escape route
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0)
                        continue;
                    if (game.isFree(particle.x + dx, particle.y + dy)) {
                        particle.directionX = dx;
                        particle.directionY = dy;
                        moveFound = true;
                        break;
                    }
                }
                if (moveFound)
                    break;
            }
        }
        // If still stuck, pick a random direction to escape
        if (!moveFound) {
            particle.directionX = n101random(false);
            particle.directionY = n101random(false);
        }
    }
}
export function staticEnergyBehavior(game, particle) {
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
export function colorCurve(points, position) {
    position = 1 - Math.max(0, Math.min(1, position)); // Clamp position to [0, 1] and invert.
    // Sort points by offset
    points.sort((a, b) => a.offset - b.offset);
    // Find the two points we are between
    let startPoint = points[0];
    let endPoint = points[points.length - 1];
    for (let i = 0; i < points.length - 1; i++) {
        if (position >= points[i].offset && position <= points[i + 1].offset) {
            startPoint = points[i];
            endPoint = points[i + 1];
            break;
        }
    }
    // Calculate the ratio between the two points
    const range = endPoint.offset - startPoint.offset;
    const ratio = range === 0 ? 0 : (position - startPoint.offset) / range;
    // Interpolate between the two colors
    const r1 = parseInt(startPoint.color.slice(1, 3), 16);
    const g1 = parseInt(startPoint.color.slice(3, 5), 16);
    const b1 = parseInt(startPoint.color.slice(5, 7), 16);
    const r2 = parseInt(endPoint.color.slice(1, 3), 16);
    const g2 = parseInt(endPoint.color.slice(3, 5), 16);
    const b2 = parseInt(endPoint.color.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
const hasTouchSupport = () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};
export class Powders {
    canvas;
    ctx;
    grid;
    mouseX = 0;
    mouseY = 0;
    lastMouseX = 0;
    lastMouseY = 0;
    mouseLeftDown = false;
    mouseRightDown = false;
    selectedType = null;
    selectedTool = null;
    tickRate = 20; // 20 ticks per second
    tmpGrid = null; // Temporary grid for updates
    _paused = false;
    width = 75;
    height = 56;
    brushSize = 0; // 1 pixel
    intensifyBrush = false; // Intensification makes tools stronger.
    keysDown = new Set();
    debugRenderShapesInput;
    doDebugRender = false;
    isMobile;
    disableAi = false; // Performance option to disable AI
    noSpecialGraphics = false; // Performance option to disable special graphics (like glow)
    _noInput = false; // Disables inputs temporarily
    debugRenderShapes = [];
    set noInput(value) {
        this._noInput = value;
        if (!value) {
            this.lastMouseX = this.mouseX;
            this.lastMouseY = this.mouseY;
        }
    }
    get noInput() {
        return this._noInput;
    }
    set paused(value) {
        this._paused = value;
        const pauseToggle = document.getElementById("mobile-p");
        if (pauseToggle) {
            pauseToggle.checked = value;
        }
    }
    get paused() {
        return this._paused;
    }
    constructor() {
        this.canvas = document.getElementById("game-canvas");
        // Quick phone UI change on the canvas (For larger canvas)
        console.log(`Window size: ${window.innerWidth}x${window.innerHeight}`);
        if (window.innerWidth < window.innerHeight && window.innerHeight >= 1000) { // More space for controls below, use larger canvas
            this.canvas.classList.add("mobile");
        }
        if (window.innerHeight < 720) { // Small screen, switch header to mobile version (hidden)
            const header = document.querySelector("header");
            header.classList.add("mobile");
        }
        const context = this.canvas.getContext("2d");
        if (!context) {
            throw new Error("Failed to get 2D context");
        }
        this.ctx = context;
        this.grid = [];
        this.debugRenderShapesInput = document.getElementById("debug-render-shapes");
        this.debugRenderShapesInput.onchange = () => {
            this.doDebugRender = this.debugRenderShapesInput.checked;
        };
        this.isMobile = hasTouchSupport();
        if (this.isMobile) {
            const mobileControls = document.getElementById("mobile-controls");
            mobileControls.style.display = "block";
            const clearTerrainBtn = document.getElementById("mobile-c-t");
            clearTerrainBtn.onclick = () => {
                this.reset(true);
            };
            const clearNoTerrainBtn = document.getElementById("mobile-c-nt");
            clearNoTerrainBtn.onclick = () => {
                this.reset(false);
            };
            const brushSizeSlider = document.getElementById("mobile-bs");
            brushSizeSlider.oninput = () => {
                this.brushSize = parseInt(brushSizeSlider.value, 10);
            };
            const debugModeToggle = document.getElementById("mobile-dmt");
            debugModeToggle.onclick = () => {
                this.toggleDebug();
            };
            const intensifyToggle = document.getElementById("mobile-it");
            intensifyToggle.onchange = () => {
                this.intensifyBrush = intensifyToggle.checked;
            };
            const pauseToggle = document.getElementById("mobile-p");
            pauseToggle.onchange = () => {
                this._paused = pauseToggle.checked; // Fixes some recursion issues.
            };
            const settingsToggle = document.getElementById("mobile-s");
            settingsToggle.onclick = () => {
                this.toggleSettings();
            };
        }
        this.initSettings();
        this.initHtml();
        this.resize(this.canvas.width, this.canvas.height, false);
        console.log("Powders game initialized!");
    }
    initHtml() {
        const uiCloseBtns = document.querySelectorAll("button[data-close]");
        uiCloseBtns.forEach((btn) => {
            const button = btn;
            const targetId = button.getAttribute("data-close");
            button.onclick = () => {
                this.closeUi(targetId);
            };
        });
    }
    closeUi(id) {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = "none";
        }
    }
    openUi(id) {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = "block";
        }
    }
    fixParticleErrors(particle) {
        // Fixes any "errors" with the particle
        // Ex:
        // - Direction not being normalized from -1 to 1
        if (particle.directionX < -1)
            particle.directionX = -1;
        if (particle.directionX > 1)
            particle.directionX = 1;
        if (particle.directionY < -1)
            particle.directionY = -1;
        if (particle.directionY > 1)
            particle.directionY = 1;
        particle.directionX = Math.round(particle.directionX);
        particle.directionY = Math.round(particle.directionY);
    }
    toggleUi(id) {
        const element = document.getElementById(id);
        if (element) {
            if (element.style.display === "block") {
                element.style.display = "none";
            }
            else {
                element.style.display = "block";
            }
        }
    }
    mouseInBounds() {
        return this.mouseX >= 0 && this.mouseX < this.canvas.width && this.mouseY >= 0 && this.mouseY < this.canvas.height;
    }
    getSettingsDict() {
        return {
            disableAi: this.disableAi,
            noSpecialGraphics: this.noSpecialGraphics,
        };
    }
    getLocalStorageSettings() {
        const settingsStr = localStorage.getItem("powdersSettings");
        if (settingsStr) {
            try {
                return JSON.parse(settingsStr);
            }
            catch (e) {
                console.error("Failed to parse settings from localStorage:", e);
                return undefined;
            }
        }
        return undefined;
    }
    saveSettings() {
        const settings = this.getSettingsDict();
        localStorage.setItem("powdersSettings", JSON.stringify(settings));
    }
    initSettings() {
        const settings = this.getLocalStorageSettings();
        if (settings) {
            if (typeof settings.disableAi === "boolean") {
                this.disableAi = settings.disableAi;
            }
            if (typeof settings.noSpecialGraphics === "boolean") {
                this.noSpecialGraphics = settings.noSpecialGraphics;
            }
        }
        // Initialize settings stuff
        const disableAiCheckbox = document.getElementById("settings-disable-ai");
        disableAiCheckbox.checked = this.disableAi;
        disableAiCheckbox.onchange = () => {
            this.disableAi = disableAiCheckbox.checked;
            this.saveSettings();
        };
        const noSpecialGraphicsCheckbox = document.getElementById("settings-no-special-graphics");
        noSpecialGraphicsCheckbox.checked = this.noSpecialGraphics;
        noSpecialGraphicsCheckbox.onchange = () => {
            this.noSpecialGraphics = noSpecialGraphicsCheckbox.checked;
            this.saveSettings();
        };
        const settingsCloseButton = document.getElementById("settings-close-button");
        settingsCloseButton.onclick = () => {
            this.toggleSettings();
        };
    }
    renderDebugSquare(x, y, width, height, color, forTick = true) {
        this.debugRenderShapes.push({ x, y, width, height, color, forTick });
    }
    processTypeId(typeId, original = null, placeholderIndex = new Map(), single = false) {
        const types = [];
        if (typeId === null) {
            return [null];
        }
        placeholderIndex.set("original", original);
        if (typeId.startsWith("#")) {
            if (single) {
                throw new Error("Cannot use tag typeId with single=true");
            }
            const tag = typeId.substring(1);
            const taggedTypes = powderTypes.getAllWithTag(tag);
            for (const type of taggedTypes) {
                const id = powderTypes.getId(type);
                if (id) {
                    types.push(id);
                }
            }
        }
        else if (typeId.startsWith("!")) {
            const placeholder = typeId.substring(1);
            const placeholderValue = placeholderIndex.get(placeholder);
            if (placeholderValue === undefined) {
                throw new Error(`Placeholder "${placeholder}" not found in index.`);
            }
            types.push(placeholderValue);
        }
        else if (typeId === "$none") { // dollar sign for special values that cant be defined with an ID
            types.push(null);
        }
        else {
            types.push(typeId);
        }
        return single ? types[0] : types;
    }
    isFree(x, y) {
        // Make sure nothing is undefined
        if (this.grid[y] === undefined) {
            return false; // If the row doesn't exist, it's not free (Out of bounds)
        }
        if (this.grid[y][x] === undefined) {
            return false; // If the cell doesn't exist, it's not free (Out of bounds)
        }
        // Individual out-of-bounds checks
        if (y < 0 || x < 0) {
            return false; // Negative coordinates are out of bounds
        }
        if (y >= this.grid.length) {
            return false; // Y coordinate is out of bounds
        }
        if (x >= this.grid[y].length) {
            return false; // X coordinate is out of bounds
        }
        if (y < 0 || y >= this.grid.length || x < 0 || x >= this.grid[y].length) {
            return false; // Out of bounds is not free
        }
        return (y >= 0 &&
            y < this.grid.length &&
            x >= 0 &&
            x < this.grid[y].length &&
            this.grid[y][x].type === null);
    }
    canSwap(type, x, y) {
        if (this.isFree(x, y)) {
            return true;
        }
        const otherParticle = this.getParticle(x, y);
        if (!otherParticle) {
            return false;
        }
        const otherType = powderTypes.require(otherParticle.type);
        const thisType = type ? powderTypes.require(type) : null;
        return (thisType?.weight ?? 1) > otherType.weight;
    }
    spawnParticle(x, y, type, replace = false) {
        if (x < 0 || y < 0 || y >= this.grid.length || x >= this.grid[y].length) {
            return; // Out of bounds
        }
        if (this.isFree(x, y) || replace) {
            const particle = new Particle(x, y, type);
            (this.tmpGrid || this.grid)[y][x] = particle;
            const typeData = type ? powderTypes.require(type) : null;
            if (typeData?.onSpawn) {
                typeData.onSpawn(this, particle);
            }
        }
    }
    removeParticle(x, y) {
        this.spawnParticle(x, y, null, true);
    }
    toggleSettings() {
        const settingsContainer = document.getElementById("settings-container");
        if (settingsContainer.style.display === "none") {
            settingsContainer.style.display = "block";
            const noSpecialGraphicsCheckbox = document.getElementById("settings-no-special-graphics");
            noSpecialGraphicsCheckbox.checked = this.noSpecialGraphics;
            noSpecialGraphicsCheckbox.onchange = () => {
                this.noSpecialGraphics = noSpecialGraphicsCheckbox.checked;
                this.saveSettings();
            };
            this.paused = true; // Pause game when entering settings
            this.noInput = true; // Stop game from recieving input
        }
        else {
            settingsContainer.style.display = "none";
            this.saveSettings(); // Save settings when exiting
            setTimeout(() => {
                this.noInput = false; // Re-enable input shortly after closing settings to prevent accidental clicks
            }, 100);
        }
    }
    listenInputs() {
        const mouseDown = (e) => {
            if (this.noInput)
                return;
            if (e.button === 0) {
                this.mouseLeftDown = true;
            }
            else if (e.button === 2) {
                this.mouseRightDown = true;
            }
            const coords = screenToCanvas(this.canvas, e.clientX, e.clientY);
            this.mouseX = coords.x;
            this.mouseY = coords.y;
            if (!this.mouseInBounds()) {
                mouseUp(e); // If mouse is out of bounds, cancel the click to prevent issues with dragging outside of the canvas
                return;
            }
        };
        document.addEventListener("mousedown", mouseDown);
        document.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
        function screenToCanvas(canvas, screenX, screenY) {
            const rect = canvas.getBoundingClientRect();
            const rectWidth = rect.width;
            const rectHeight = rect.height;
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            // Calculate the aspect ratios
            const rectAspect = rectWidth / rectHeight;
            const canvasAspect = canvasWidth / canvasHeight;
            let displayWidth = rectWidth;
            let displayHeight = rectHeight;
            let offsetX = 0;
            let offsetY = 0;
            // Adjust for aspect ratio mismatch
            if (rectAspect > canvasAspect) {
                // Canvas display is wider than canvas data
                displayWidth = rectHeight * canvasAspect;
                offsetX = (rectWidth - displayWidth) / 2;
            }
            else if (rectAspect < canvasAspect) {
                // Canvas display is taller than canvas data
                displayHeight = rectWidth / canvasAspect;
                offsetY = (rectHeight - displayHeight) / 2;
            }
            // Calculate the scale factors for each dimension
            const scaleX = canvasWidth / displayWidth;
            const scaleY = canvasHeight / displayHeight;
            // Convert screen coordinates to canvas image data coordinates
            const x = Math.floor((screenX - rect.left - offsetX) * scaleX);
            const y = Math.floor((screenY - rect.top - offsetY) * scaleY);
            return { x, y };
        }
        const mouseUp = (e) => {
            if (this.noInput)
                return;
            if (e.button === 0) {
                this.mouseLeftDown = false;
            }
            else if (e.button === 2) {
                this.mouseRightDown = false;
            }
        };
        document.addEventListener("mouseup", mouseUp);
        const mouseMove = (e) => {
            if (this.noInput)
                return;
            const coords = screenToCanvas(this.canvas, e.clientX, e.clientY);
            this.mouseX = coords.x;
            this.mouseY = coords.y;
        };
        document.addEventListener("mousemove", mouseMove);
        const keyDown = (e) => {
            if (this.noInput)
                return;
            this.keysDown.add(e.key);
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
                case "C":
                    this.reset(false);
                    break;
                case "c":
                    this.reset(true);
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
                case "s":
                    this.toggleSettings();
                    break;
            }
        };
        document.addEventListener("keydown", keyDown);
        const keyUp = (e) => {
            this.keysDown.delete(e.key);
            switch (e.key) {
                case "Shift":
                    this.intensifyBrush = false;
                    break;
            }
        };
        document.addEventListener("keyup", keyUp);
        // Mobile inputs
        document.addEventListener("touchstart", (e) => {
            if (this.noInput)
                return;
            this.canvas.focus();
            const touch = e.touches[0];
            const pos = screenToCanvas(this.canvas, touch.clientX, touch.clientY);
            this.mouseX = pos.x;
            this.mouseY = pos.y;
            this.lastMouseX = this.mouseX;
            this.lastMouseY = this.mouseY;
            if (!this.mouseInBounds()) {
                return;
            }
            this.mouseLeftDown = true;
        });
        document.addEventListener("touchend", (e) => {
            if (this.noInput)
                return;
            this.mouseLeftDown = false;
        });
        document.addEventListener("touchmove", (e) => {
            if (this.noInput)
                return;
            const touch = e.touches[0];
            const pos = screenToCanvas(this.canvas, touch.clientX, touch.clientY);
            this.mouseX = pos.x;
            this.mouseY = pos.y;
        });
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.paused = true;
            }
        });
    }
    drawParticleRect(x, y, width, height, type, replace = false) {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                this.spawnParticle(x + dx, y + dy, type, replace);
            }
        }
    }
    drawParticleLine(x1, y1, x2, y2, type, replace = false, width = 1) {
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
    getAdjacentParticles(x, y) {
        const adjacent = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0)
                    continue; // Skip the center particle
                const adjParticle = this.getParticle(x + dx, y + dy);
                if (adjParticle) {
                    adjacent.push(adjParticle);
                }
            }
        }
        return adjacent;
    }
    getAdjacentOfType(x, y, type) {
        const adjacent = this.getAdjacentParticles(x, y).filter(p => p.type === type);
        return adjacent[0] ? adjacent[0] : null;
    }
    swapParticles(x1, y1, x2, y2) {
        const temp = (this.tmpGrid || this.grid)[y1][x1];
        (this.tmpGrid || this.grid)[y1][x1] = (this.tmpGrid || this.grid)[y2][x2];
        (this.tmpGrid || this.grid)[y2][x2] = temp;
        // Make sure to update the particle's internal coordinates after swapping
        (this.tmpGrid || this.grid)[y1][x1].x = x1;
        (this.tmpGrid || this.grid)[y1][x1].y = y1;
        (this.tmpGrid || this.grid)[y2][x2].x = x2;
        (this.tmpGrid || this.grid)[y2][x2].y = y2;
    }
    raycast(x, y, angle, maxDist) {
        if (maxDist === undefined) {
            maxDist = Math.ceil(Math.sqrt((this.width * this.width) + (this.height * this.height)));
        }
        const endX = x + Math.cos(angle) * maxDist;
        const endY = y + Math.sin(angle) * maxDist;
        const particlesInLine = this.getParticlesInLine(x, y, endX, endY);
        for (const particle of particlesInLine) {
            if (particle.type !== null) {
                return { x: particle.x, y: particle.y, particle };
            }
        }
        return { x: endX, y: endY, particle: null };
    }
    update() {
        this.debugRenderShapes = this.debugRenderShapes.filter(shape => !shape.forTick);
        this.tmpGrid = [];
        for (let y = 0; y < this.grid.length; y++) {
            const newRow = [];
            for (let x = 0; x < this.grid[y].length; x++) {
                const particle = this.grid[y][x];
                if (particle && particle.type !== null) {
                    newRow.push(particle);
                }
                else {
                    newRow.push(new Particle(x, y, null));
                }
            }
            this.tmpGrid.push(newRow);
        }
        for (let y = this.grid.length - 1; y >= 0; y--) {
            for (let x = 0; x < this.grid[y].length; x++) {
                const particle = this.grid[y][x];
                if (particle && particle.type !== null) {
                    const type = powderTypes.require(particle.type);
                    type.behavior(this, particle);
                    for (const reaction of type.reactions || []) {
                        if (Math.random() < reaction.chance) {
                            const allReactionTypes = this.processTypeId(reaction.with);
                            let otherParticle = null;
                            for (const type of allReactionTypes) {
                                if (type === null) {
                                    continue; // Ignore
                                }
                                otherParticle = this.getAdjacentOfType(particle.x, particle.y, type);
                                if (otherParticle)
                                    break;
                            }
                            if (otherParticle) {
                                if (reaction.behavior) {
                                    reaction.behavior(this, particle, otherParticle);
                                }
                                else {
                                    const newResult = this.processTypeId(reaction.result, particle.type, new Map(), true);
                                    // Default reaction behavior: spawn result at the location of the first particle and destroy the second
                                    this.spawnParticle(particle.x, particle.y, newResult, true);
                                    if (reaction.secondResult) {
                                        const secondResult = this.processTypeId(reaction.secondResult, otherParticle.type, new Map(), true);
                                        this.spawnParticle(otherParticle.x, otherParticle.y, secondResult, true);
                                    }
                                    else {
                                        this.spawnParticle(otherParticle.x, otherParticle.y, null, true);
                                    }
                                }
                            }
                        }
                    }
                    const adjacentParticles = this.getAdjacentParticles(particle.x, particle.y);
                    for (const adj of adjacentParticles) {
                        if (adj.type !== null) {
                            const tempDiff = particle.temp - adj.temp;
                            const transferAmount = tempDiff * (powderTypes.require(particle.type).tempTransferRate || airTempTransferRate);
                            particle.temp -= transferAmount;
                            adj.temp += transferAmount;
                        }
                    }
                    if (adjacentParticles.filter(p => p !== null).length < 8) {
                        // If there are less than 8 (non-null) adjacent particles, transfer some heat to the air (which is effectively a heat loss)
                        const tempDiff = particle.temp - 22; // Assuming air temp is 22 Celsius
                        const transferAmount = tempDiff * airTempTransferRate;
                        particle.temp -= transferAmount;
                    }
                    if (type.meltingPoint !== null && type.meltingPoint !== undefined && particle.temp >= type.meltingPoint) {
                        this.spawnParticle(particle.x, particle.y, type.meltingResult, true);
                        if (type.meltingResultSecond) {
                            // Spawn second result in a random adjacent free space, or on top of the first result if no free space
                            const randomDirectionX = n101random(false);
                            const randomDirectionY = n101random(false);
                            if (this.isFree(particle.x + randomDirectionX, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y + randomDirectionY, type.meltingResultSecond, true);
                            }
                            else if (this.isFree(particle.x - randomDirectionX, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y - randomDirectionY, type.meltingResultSecond, true);
                            }
                            else if (this.isFree(particle.x + randomDirectionX, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y - randomDirectionY, type.meltingResultSecond, true);
                            }
                            else if (this.isFree(particle.x - randomDirectionX, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y + randomDirectionY, type.meltingResultSecond, true);
                            }
                            else if (this.isFree(particle.x + randomDirectionX, particle.y)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y, type.meltingResultSecond, true);
                            }
                            else if (this.isFree(particle.x - randomDirectionX, particle.y)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y, type.meltingResultSecond, true);
                            }
                            else if (this.isFree(particle.x, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x, particle.y + randomDirectionY, type.meltingResultSecond, true);
                            }
                            else if (this.isFree(particle.x, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x, particle.y - randomDirectionY, type.meltingResultSecond, true);
                            }
                            else {
                                this.spawnParticle(particle.x, particle.y, type.meltingResultSecond, true);
                            }
                        }
                    }
                    else if (type.freezingPoint !== null && type.freezingPoint !== undefined && particle.temp <= type.freezingPoint) {
                        this.spawnParticle(particle.x, particle.y, type.freezingResult, true);
                        if (type.freezingResultSecond) {
                            // Spawn second result in a random adjacent free space, or on top of the first result if no free space
                            const randomDirectionX = n101random(false);
                            const randomDirectionY = n101random(false);
                            if (this.isFree(particle.x + randomDirectionX, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y + randomDirectionY, type.freezingResultSecond, true);
                            }
                            else if (this.isFree(particle.x - randomDirectionX, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y - randomDirectionY, type.freezingResultSecond, true);
                            }
                            else if (this.isFree(particle.x + randomDirectionX, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y - randomDirectionY, type.freezingResultSecond, true);
                            }
                            else if (this.isFree(particle.x - randomDirectionX, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y + randomDirectionY, type.freezingResultSecond, true);
                            }
                            else if (this.isFree(particle.x + randomDirectionX, particle.y)) {
                                this.spawnParticle(particle.x + randomDirectionX, particle.y, type.freezingResultSecond, true);
                            }
                            else if (this.isFree(particle.x - randomDirectionX, particle.y)) {
                                this.spawnParticle(particle.x - randomDirectionX, particle.y, type.freezingResultSecond, true);
                            }
                            else if (this.isFree(particle.x, particle.y + randomDirectionY)) {
                                this.spawnParticle(particle.x, particle.y + randomDirectionY, type.freezingResultSecond, true);
                            }
                            else if (this.isFree(particle.x, particle.y - randomDirectionY)) {
                                this.spawnParticle(particle.x, particle.y - randomDirectionY, type.freezingResultSecond, true);
                            }
                            else {
                                this.spawnParticle(particle.x, particle.y, type.freezingResultSecond, true);
                            }
                        }
                    }
                    if (type.flammability) {
                        if (particle.temp >= (type.ignitionPoint || 600)) {
                            particle.lightOnFire();
                        }
                    }
                    if (particle.onFire) {
                        // Not undefined and flammability > 0
                        if (type.flammability) {
                            // Chance to produce fire particle depending on flammability
                            if (Math.random() < type.flammability) {
                                let randomDirectionX = n101random(false);
                                const randomDirectionY = n101random(false);
                                if (this.isFree(particle.x + randomDirectionX, particle.y + randomDirectionY)) {
                                    this.spawnParticle(particle.x + randomDirectionX, particle.y + randomDirectionY, "fire", true);
                                }
                                else if (this.isFree(particle.x - randomDirectionX, particle.y - randomDirectionY)) {
                                    this.spawnParticle(particle.x - randomDirectionX, particle.y - randomDirectionY, "fire", true);
                                }
                                else if (this.isFree(particle.x + randomDirectionX, particle.y - randomDirectionY)) {
                                    this.spawnParticle(particle.x + randomDirectionX, particle.y - randomDirectionY, "fire", true);
                                }
                                else if (this.isFree(particle.x - randomDirectionX, particle.y + randomDirectionY)) {
                                    this.spawnParticle(particle.x - randomDirectionX, particle.y + randomDirectionY, "fire", true);
                                }
                                else if (this.isFree(particle.x + randomDirectionX, particle.y)) {
                                    this.spawnParticle(particle.x + randomDirectionX, particle.y, "fire", true);
                                }
                                else if (this.isFree(particle.x - randomDirectionX, particle.y)) {
                                    this.spawnParticle(particle.x - randomDirectionX, particle.y, "fire", true);
                                }
                                else if (this.isFree(particle.x, particle.y + randomDirectionY)) {
                                    this.spawnParticle(particle.x, particle.y + randomDirectionY, "fire", true);
                                }
                                else if (this.isFree(particle.x, particle.y - randomDirectionY)) {
                                    this.spawnParticle(particle.x, particle.y - randomDirectionY, "fire", true);
                                }
                                else {
                                    this.spawnParticle(particle.x, particle.y, type.burnInto ? type.burnInto : "fire", true);
                                }
                            }
                        }
                        else {
                            particle.onFire = false; // If not flammable, stop being on fire
                        }
                    }
                    this.fixParticleErrors(particle);
                }
            }
        }
        this.grid = this.tmpGrid;
        this.tmpGrid = null;
        this.updatePositions();
    }
    toggleDebug() {
        const debugInfo = document.getElementById("debug-info");
        if (debugInfo.style.display === "none") {
            debugInfo.style.display = "block";
        }
        else {
            debugInfo.style.display = "none";
        }
    }
    mouseDraw() {
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
        }
        else {
            this.lastMouseX = this.mouseX;
            this.lastMouseY = this.mouseY;
            const toolAction = toolTypes.require(this.selectedTool).action;
            if (toolAction) {
                toolAction(this, this.mouseX, this.mouseY);
            }
        }
    }
    getParticlesInCircle(centerX, centerY, radius) {
        const particles = [];
        const radiusSquared = radius * radius;
        for (let y = Math.max(0, Math.floor(centerY - radius)); y <= Math.min(this.grid.length - 1, Math.ceil(centerY + radius)); y++) {
            for (let x = Math.max(0, Math.floor(centerX - radius)); x <= Math.min(this.grid[y].length - 1, Math.ceil(centerX + radius)); x++) {
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
    getParticlesInSquare(x, y, width, height) {
        const particles = [];
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
            for (let i = Math.max(0, x); i < Math.min(this.grid[0].length, x + width); i++) {
                const particle = this.getParticle(i, y);
                if (particle) {
                    particles.push(particle);
                }
            }
            return particles;
        }
        for (let j = Math.max(0, y); j < Math.min(this.grid.length, y + height); j++) {
            for (let i = Math.max(0, x); i < Math.min(this.grid[j].length, x + width); i++) {
                const particle = this.getParticle(i, j);
                if (particle) {
                    particles.push(particle);
                }
            }
        }
        return particles;
    }
    render() {
        this.debugRenderShapes = this.debugRenderShapes.filter(shape => shape.forTick);
        const toolData = this.selectedTool ? toolTypes.require(this.selectedTool) : null;
        if (toolData && !toolData.onTick) {
            this.mouseDraw();
        }
        else if (this.selectedTool === null) {
            this.mouseDraw(); // For drawing.
        }
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        let glows = [];
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                const particle = this.grid[y][x];
                if (particle && particle.type !== null) {
                    const type = powderTypes.require(particle.type);
                    // particle.deco ? particle.deco : type.color;
                    const drawColor = particle.deco ? particle.deco : type.color;
                    ;
                    if (type.luminosity) {
                        glows.push({ x, y, color: drawColor });
                    }
                    this.ctx.fillStyle = drawColor;
                    this.ctx.fillRect(x, y, 1, 1);
                } // Skip draw otherwise for better performance
            }
        }
        if (!this.noSpecialGraphics) {
            for (const glow of glows) {
                this.ctx.fillStyle = glow.color;
                this.ctx.globalAlpha = 0.5;
                this.ctx.fillRect(glow.x - 1, glow.y, 1, 1);
                this.ctx.fillRect(glow.x + 1, glow.y, 1, 1);
                this.ctx.fillRect(glow.x, glow.y - 1, 1, 1);
                this.ctx.fillRect(glow.x, glow.y + 1, 1, 1);
                this.ctx.globalAlpha = 1.0;
            }
        }
        // Debug info
        const mouseParticle = this.getParticle(this.mouseX, this.mouseY);
        const debugMousePos = document.getElementById("dbg-mouse-pos");
        debugMousePos.textContent = `${this.mouseX}, ${this.mouseY} (${mouseParticle?.type ?? "none"})`;
        const debugParticleInfo = document.getElementById("dbg-particle-info");
        debugParticleInfo.textContent = mouseParticle ? `Particle type: ${mouseParticle.type}, Particle deco: ${mouseParticle.deco ?? "none"}, Particle Temperature (Celsius): ${mouseParticle.temp ?? "N/A"}` : "No particle";
        // Draw brush preview
        this.ctx.fillStyle = "white";
        this.ctx.globalAlpha = 0.35;
        this.ctx.fillRect(this.mouseX - this.brushSize, this.mouseY - this.brushSize, this.brushSize * 2 + 1, this.brushSize * 2 + 1);
        // Debug rendering
        const showDebugShapes = this.doDebugRender && this.debugRenderShapes.length > 0;
        if (showDebugShapes) {
            this.ctx.globalAlpha = 0.75;
            for (const shape of this.debugRenderShapes) {
                this.ctx.fillStyle = shape.color;
                this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
            }
        }
        this.ctx.globalAlpha = 1.0;
    }
    getParticle(x, y) {
        if (y >= 0 && y < this.grid.length && x >= 0 && x < this.grid[y].length) {
            return this.grid[y][x];
        }
        return null;
    }
    startGame() {
        console.log("Starting Powders game...");
        this.resize(this.canvas.width, this.canvas.height);
        this.listenInputs();
        const gameLoop = () => {
            if (!this.paused) {
                this.update();
                setTimeout(() => {
                    requestAnimationFrame(gameLoop);
                }, 1000 / this.tickRate);
            }
            else {
                requestAnimationFrame(gameLoop);
            }
        };
        const renderLoop = () => {
            this.render();
            requestAnimationFrame(renderLoop);
        };
        const toolTickLoop = () => {
            const toolData = this.selectedTool ? toolTypes.require(this.selectedTool) : null;
            if (toolData && toolData.onTick) {
                this.mouseDraw();
            }
            setTimeout(() => {
                requestAnimationFrame(toolTickLoop);
            }, 1000 / this.tickRate);
        };
        requestAnimationFrame(gameLoop);
        requestAnimationFrame(renderLoop);
        requestAnimationFrame(toolTickLoop);
    }
    reset(generateTerrain = true) {
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(new Particle(x, y, null));
            }
            this.grid.push(row);
        }
        if (generateTerrain) {
            this.generateSimpleTerrain();
        }
    }
    resize(width, height, generateTerrain = true) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this.reset(generateTerrain);
    }
    updatePositions() {
        const newGrid = [];
        for (let y = 0; y < this.grid.length; y++) {
            const newRow = [];
            for (let x = 0; x < this.grid[y].length; x++) {
                newRow.push(new Particle(x, y, null));
            }
            newGrid.push(newRow);
        }
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                const particle = this.grid[y][x];
                if (particle && particle.type !== null) {
                    particle.x = particle.x;
                    particle.y = particle.y;
                    const newX = Math.max(0, Math.min(particle.x, newGrid[0].length - 1));
                    const newY = Math.max(0, Math.min(particle.y, newGrid.length - 1));
                    newGrid[newY][newX] = particle;
                }
            }
        }
        this.grid = newGrid;
    }
    crushParticle(x, y) {
        const particle = this.getParticle(x, y);
        if (particle && particle.type) {
            const type = powderTypes.require(particle.type);
            if (type.crushResult) {
                this.spawnParticle(x, y, type.crushResult, true);
            }
        }
    }
    generateSimpleTerrain() {
        const bedrockHeight = this.canvas.height - 1; // Bedrock layer at the bottom
        const stoneHeight = this.canvas.height * (1 - 0.2); // Stone layer above bedrock
        const dirtHeight = this.canvas.height * (1 - 0.3); // Dirt layer above stone
        const grassHeight = dirtHeight - 1; // Grass layer 1 above dirt
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                if (y >= bedrockHeight) {
                    this.grid[y][x] = new Particle(x, y, PowderTypes.BEDROCK);
                }
                else if (y >= stoneHeight) {
                    this.grid[y][x] = new Particle(x, y, PowderTypes.STONE);
                }
                else if (y >= dirtHeight) {
                    this.grid[y][x] = new Particle(x, y, "dirt");
                }
                else if (y >= grassHeight) {
                    this.grid[y][x] = new Particle(x, y, "grass");
                }
            }
        }
    }
    getParticlesInLine(x1, y1, x2, y2) {
        const particles = [];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        if (steps === 0) {
            const particle = this.getParticle(x1, y1);
            if (particle) {
                particles.push(particle);
            }
            return particles;
        }
        const stepX = dx / steps;
        const stepY = dy / steps;
        for (let i = 0; i <= steps; i++) {
            const x = Math.round(x1 + stepX * i);
            const y = Math.round(y1 + stepY * i);
            const particle = this.getParticle(x, y);
            if (particle) {
                particles.push(particle);
            }
        }
        return particles;
    }
    explode(x, y, radius, force, lightFire = true, nuclear = false) {
        const resolution = 32; // 32 rays for a more circular explosion.
        for (let i = 0; i < resolution; i++) {
            const angle = (i / resolution) * 2 * Math.PI;
            const rayX = Math.cos(angle);
            const rayY = Math.sin(angle);
            const particlesInRay = this.getParticlesInLine(x, y, Math.floor(x + rayX * (radius + (nuclear ? 5 : 0))), Math.floor(y + rayY * (radius + (nuclear ? 5 : 0))));
            let currentForce = force;
            for (let j = 0; j < particlesInRay.length; j++) {
                const particle = particlesInRay[j];
                if (j >= radius) {
                    if (!nuclear) {
                        break; // Stop the ray if it goes beyond the explosion radius (unless it's a nuclear explosion, which has lingering radiation)
                    }
                    // Spawn fallout particles in free space with 5% chance
                    if (Math.random() < 0.05) {
                        // Uhhh n101 random's only argument is to use less zero results (default true)
                        const falloutX = Math.floor(x + rayX * (radius + 5 + n101random()));
                        const falloutY = Math.floor(y + rayY * (radius + 5 + n101random()));
                        if (this.isFree(falloutX, falloutY)) {
                            this.spawnParticle(falloutX, falloutY, "fallout", true);
                        }
                    }
                    // Spawn radiation, plasma, or a neutron (biased to radiation) with 1% chance in free space for nuclear explosions
                    if (nuclear && Math.random() < 0.01) {
                        const radiationX = Math.floor(x + rayX * (radius + 5 + n101random()));
                        const radiationY = Math.floor(y + rayY * (radius + 5 + n101random()));
                        if (this.isFree(radiationX, radiationY)) {
                            const random = Math.random();
                            if (random < 0.75) {
                                this.spawnParticle(radiationX, radiationY, "radiation", true);
                            }
                            else if (random < 0.875) {
                                this.spawnParticle(radiationX, radiationY, "plasma", true);
                            }
                            else { // Neutron particles added in 1.0.0.
                                this.spawnParticle(radiationX, radiationY, "neutron", true);
                            }
                        }
                    }
                }
                const type = particle.type ? powderTypes.require(particle.type) : null;
                const resistance = type?.explosionResistance ?? 0;
                if (currentForce > resistance) {
                    currentForce -= resistance;
                    if (lightFire) {
                        particle.lightOnFire();
                    }
                    const random = Math.random();
                    if (nuclear) {
                        if (random < 0.125) {
                            this.spawnParticle(particle.x, particle.y, "plasma", true);
                        }
                        else if (random < 0.25) {
                            this.spawnParticle(particle.x, particle.y, "fallout", true);
                        }
                        else {
                            this.spawnParticle(particle.x, particle.y, null, true);
                        }
                    }
                }
                else {
                    break; // Stop the ray if it hits a particle that can fully resist the explosion
                }
            }
        }
    }
}
let game = null;
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
    game.startGame();
    const button = document.getElementById("start-button");
    button.style.display = "none";
}
export function getGame() {
    return game;
}
// Vanilla elements
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
    weight: 1,
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
    weight: 0.5,
    explosionResistance: 0.5, // Ice can partially resist explosions, reducing their damage by half a unit
});
powderTypes.register("gunpowder", {
    name: "Gunpowder",
    color: "#4b4d3f",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        powderBehavior(game, particle);
        if (particle.onFire) {
            game.explode(particle.x, particle.y, 5, 3); // Explode with radius 5 and force 3 when on fire
        }
    },
    defaultTemp: 22,
    tempTransferRate: 0.05,
    flammability: 0.9, // Very flammable, has a high chance to produce fire particles when on fire
    state: "powder",
    category: "Powders",
    explosionResistance: 0, // Cannot resist explosions at all
    weight: 0.8, // Lighter than sand, which is 1, to reflect how gunpowder is less dense than sand
});
powderTypes.register("tnt", {
    name: "TNT",
    color: "#e40000",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        solidBehavior(game, particle);
        if (particle.onFire) {
            game.explode(particle.x, particle.y, 10, 5); // Explode with radius 10 and force 5 when on fire
        }
    },
    defaultTemp: 22,
    tempTransferRate: 0.05,
    flammability: 0.9, // Very flammable, has a high chance to produce fire particles when on fire
    state: "solid",
    category: "Solids",
    explosionResistance: 0, // Cannot resist explosions at all
    weight: 1.5, // Heavier than sand, which is 1, to reflect how TNT is denser than sand
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
    explosionResistance: 0.3, // Snow can partially resist explosions, reducing their damage by 0.3 units (Worse than ice)
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
    explosionResistance: 0.1, // Only able to resist from impurities
});
powderTypes.register("impurity", {
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
    // Impurities are somewhat explosive now :)
    flammability: 0.5, // Impurities can catch fire, adding a small chance for certain reactions to create a fire particle when an impurity is present
    explosionResistance: 0.1, // Same as dirty water.
});
powderTypes.register("titanium", {
    name: "Titanium",
    color: "#b0b0b0",
    colorVariation: 0.1,
    behavior: solidBehavior, // A strong metal that does not move, but can be melted by heat
    defaultTemp: 22,
    tempTransferRate: 0.05,
    meltingPoint: 1668, // Titanium melts at 1668C
    meltingResult: "liquid_titanium",
    state: "solid",
    category: "Metals",
    weight: 4.5,
    crushResult: "titanium_shard", // When titanium is crushed (like by a tool), it has a chance to turn into a titanium shard (representing the jagged pieces created from crushing the metal) instead of just being removed
    explosionResistance: 2.5, // Titanium can resist explosions very well, reducing their damage by 2.5 units
});
powderTypes.register("liquid_titanium", {
    name: "Liquid Titanium",
    color: "#ff9d00",
    colorVariation: 0.1,
    behavior: liquidBehavior, // Molten titanium, behaves like a liquid but much heavier and can solidify back into titanium when cooled
    defaultTemp: 1700,
    tempTransferRate: 0.1,
    freezingPoint: 1668, // When liquid titanium cools down to 1668C or below, it solidifies back into titanium
    freezingResult: "titanium",
    state: "liquid",
    category: "Metals",
    weight: 4.5,
    luminosity: true, // Glows brightly when molten
});
powderTypes.register("titanium_shard", {
    name: "Titanium Shard",
    color: "#b0b0b0",
    colorVariation: 0.2,
    behavior: powderBehavior, // A shard of titanium that can be created from crushing titanium, behaves like a powder but heavier than regular titanium due to its jagged shape
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "powder",
    category: "Metals",
    meltingPoint: 1668, // Titanium shard can melt back into liquid titanium at 1668C (making it re-usable)
    meltingResult: "liquid_titanium",
    weight: 5, // Heavier than regular titanium due to jagged shape
    crushResult: "metal_dust", // When titanium shard is crushed, it turns into metal dust (representing the fine particles created from grinding down the shard)
    explosionResistance: 0.25, // Bad for explosion resistance, shattered
});
powderTypes.register("metal_dust", {
    name: "Metal Dust",
    color: "#636363",
    colorVariation: 0.2,
    behavior: powderBehavior,
    defaultTemp: 22,
    tempTransferRate: 0.01,
    state: "solid",
    category: "Special",
    weight: -0.75, // Super light, but heavier than normal dust, most gases can swap with it, making it rise.
    crushResult: null, // Dust cannot be crushed
    meltingPoint: 1500, // Metal dust can melt at 1500C
    meltingResult: "liquid_junk_metal", // Too impure to extract original metal, so just junk
    explosionResistance: 0.0, // Unable to affect explosions.
});
powderTypes.register("nuke", {
    name: "Nuke",
    color: "#1e591e",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        solidBehavior(game, particle);
        if (particle.onFire) {
            game.explode(particle.x, particle.y, 50, 10, true, true); // Explode with radius 50 and force 10 when on fire, also light fires and is a nuclear explosion
        }
    },
    state: "solid",
    defaultTemp: 22,
    tempTransferRate: 0.05,
    flammability: 0.9, // Very flammable, has a high chance to produce fire particles when on fire
    category: "Special",
    weight: 10, // Very heavy, to reflect the massive amount of material in a nuke
    explosionResistance: 0, // Cannot resist explosions at all, will be destroyed by other explosions
});
powderTypes.register("junk_metal", {
    name: "Junk Metal",
    color: "#7f7f7f",
    colorVariation: 0.2,
    behavior: solidBehavior, // A solid piece of junk metal that can be created from certain reactions, behaves like a solid but can be melted by heat
    defaultTemp: 22,
    tempTransferRate: 0.05,
    meltingPoint: 1500, // Junk metal can melt at 1500C
    meltingResult: "liquid_junk_metal",
    state: "solid",
    category: "Metals",
    weight: 3,
    crushResult: "metal_dust", // When junk metal is crushed, it turns into metal dust (representing the fine particles created from grinding down the junk)
    explosionResistance: 0.1, // Not very resistant to explosions, can be easily damaged or destroyed by them
});
powderTypes.register("liquid_junk_metal", {
    name: "Liquid Junk Metal",
    color: "#d9b750",
    colorVariation: 0.2,
    behavior: liquidBehavior, // Molten junk metal, behaves like a liquid but can solidify back into junk metal when cooled
    defaultTemp: 1550,
    tempTransferRate: 0.1,
    freezingPoint: 1500, // When liquid junk metal cools down to 1500C or below, it solidifies back into junk metal
    freezingResult: "junk_metal",
    state: "liquid",
    category: "Metals",
    weight: 3,
    luminosity: true, // Glows when molten, but not as bright as liquid titanium
    explosionResistance: 0.1 // Not very resistant to explosions, can be easily damaged or destroyed by them
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
    explosionResistance: 0.05, // Ash can slightly resist explosions, reducing their damage by 0.05 units
});
function falloutBehavior(game, particle, behavior = powderBehavior) {
    behavior(game, particle);
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
function particleWalkSideways(game, particle, direction) {
    // Try to "walk" sideways, stepping up or down if needed.
    if (game.isFree(particle.x + direction, particle.y)) {
        game.swapParticles(particle.x, particle.y, particle.x + direction, particle.y);
    }
    else if (game.isFree(particle.x + direction, particle.y - 1)) {
        game.swapParticles(particle.x, particle.y, particle.x + direction, particle.y - 1);
    }
    else if (game.isFree(particle.x + direction, particle.y + 1)) {
        game.swapParticles(particle.x, particle.y, particle.x + direction, particle.y + 1);
    }
}
function particleJump(game, particle) {
    if (game.isFree(particle.x, particle.y + 1)) {
        return; // Cannot jump, no ground
    }
    // Try to "jump" up, then sideways, then up again if needed.
    if (game.isFree(particle.x, particle.y - 1)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y - 1);
        game.renderDebugSquare(particle.x, particle.y - 1, 1, 1, "rgba(0, 255, 255, 0.5)");
    }
    else if (game.isFree(particle.x - 1, particle.y - 1)) {
        game.swapParticles(particle.x, particle.y, particle.x - 1, particle.y - 1);
        game.renderDebugSquare(particle.x - 1, particle.y - 1, 1, 1, "rgba(0, 255, 255, 0.5)");
    }
    else if (game.isFree(particle.x + 1, particle.y - 1)) {
        game.swapParticles(particle.x, particle.y, particle.x + 1, particle.y - 1);
        game.renderDebugSquare(particle.x + 1, particle.y - 1, 1, 1, "rgba(0, 255, 255, 0.5)");
    }
}
function particleFly(game, particle, direction) {
    // Try to fly up/down in the given direction, then sideways if needed.
    if (game.isFree(particle.x, particle.y - direction)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y - direction);
    }
    else if (game.isFree(particle.x - 1, particle.y - direction)) {
        game.swapParticles(particle.x, particle.y, particle.x - 1, particle.y - direction);
    }
    else if (game.isFree(particle.x + 1, particle.y - direction)) {
        game.swapParticles(particle.x, particle.y, particle.x + 1, particle.y - direction);
    }
}
function creatureDefaultBehaviors(game, particle) {
    // If the creature touches a particle tagged with "ai_kill", it dies (turns into nothing).
    const killTag = "ai_kill";
    const adjacentParticles = game.getAdjacentParticles(particle.x, particle.y);
    for (const p of adjacentParticles) {
        if (p && p.type && powderTypes.isTagged(p.type, killTag)) {
            game.spawnParticle(particle.x, particle.y, "blood", true); // Kill the creature
            break;
        }
    }
    if (!game.disableAi) { // Disable hunger if disabling AI
        if (particle.bvs4 <= 0) {
            // Died to hunger.
            game.spawnParticle(particle.x, particle.y, "blood", true);
        }
        else {
            particle.bvs4--; // Decrease hunger timer each tick, when it reaches 0 the creature dies of hunger
        }
    }
}
const creatureMaxHunger = 200;
function creatureOnSpawn(game, particle) {
    particle.bvs4 = creatureMaxHunger; // BSV4 will be used as hunger (<80 ticks will search for food)
}
function creatureEatParticle(game, particle) {
    const foodTag = "edible";
    const adjacentParticles = game.getAdjacentParticles(particle.x, particle.y);
    for (const p of adjacentParticles) {
        if (p && p.type && powderTypes.isTagged(p.type, foodTag)) {
            game.spawnParticle(p.x, p.y, "dirt", true); // Remove the food particle
            particle.bvs4 = creatureMaxHunger; // Reset hunger timer when eating
            break;
        }
    }
}
function creaturePoiCheck(game, particle, viewDistX, viewDistY) {
    const poiFoodTag = "edible";
    const poiDangerTag = "ai_danger";
    const poiTag = "ai_poi";
    let foundFood = false;
    let foundDanger = false;
    let directionX = 0;
    let directionY = 0;
    let poiX = 0;
    let poiY = 0;
    let isAdjacent = false;
    let closestDistance = Infinity;
    const squareX = particle.x - viewDistX;
    const squareY = particle.y - viewDistY;
    const squareWidth = viewDistX * 2 + 1;
    const squareHeight = viewDistY * 2 + 1;
    let nearbyParticles = game.getParticlesInSquare(squareX, squareY, squareWidth, squareHeight).filter(p => p !== null); // Get all particles in the square around the creature, filtering out nulls
    nearbyParticles = nearbyParticles.filter(p => p.type && powderTypes.isTagged(p.type, poiTag)); // Filter to only particles that are tagged as POIs
    game.renderDebugSquare(squareX, squareY, squareWidth, squareHeight, "rgba(255, 0, 255, 0.5)");
    for (const p of nearbyParticles) {
        if (p && p.type) {
            const distance = Math.hypot(p.x - particle.x, p.y - particle.y);
            if (powderTypes.isTagged(p.type, poiDangerTag)) {
                if (distance < closestDistance) {
                    foundDanger = true;
                    closestDistance = distance;
                    directionX = p.x - particle.x;
                    directionY = p.y - particle.y;
                    poiX = p.x;
                    poiY = p.y;
                }
            }
            else if (powderTypes.isTagged(p.type, poiFoodTag)) {
                if (distance < closestDistance) {
                    foundFood = true;
                    closestDistance = distance;
                    directionX = p.x - particle.x;
                    directionY = p.y - particle.y;
                    poiX = p.x;
                    poiY = p.y;
                }
            }
            if (Math.abs(p.x - particle.x) <= 1 && Math.abs(p.y - particle.y) <= 1) {
                isAdjacent = true;
            }
        }
    }
    directionX = directionX === 0 ? 0 : directionX / Math.abs(directionX); // Normalize to -1, 0, or 1
    directionY = directionY === 0 ? 0 : directionY / Math.abs(directionY);
    directionY = -directionY;
    let typeFound = null;
    if (foundDanger) {
        typeFound = "poi_danger";
    }
    else if (foundFood) {
        typeFound = "poi_food";
    }
    game.renderDebugSquare(poiX, poiY, 1, 1, "rgba(0, 0, 255, 1.0)"); // Debug square for target POI
    return { typeFound, directionX, directionY, poiX, poiY, isAdjacent };
}
function landCreatureBehavior(game, particle) {
    creatureDefaultBehaviors(game, particle);
    const viewDistanceX = 8;
    const viewDistanceY = 8;
    if (particle.bvs2 > 0) { // If behavior value 2 is greater than 0, it means the creature is currently trying to run away from danger
        const dangerDirectionX = particle.bvs1;
        particle.bvs2--; // Decrease the timer for running away
        particleWalkSideways(game, particle, -dangerDirectionX);
    }
    else {
        // Simple land creature behavior, moves randomly left or right, sometimes jumping.
        let moveDirectionX = n101random(); // Set to false to lower movement chance.
        let doJump = false;
        if (!game.disableAi) {
            // Check view for POIs
            const poiResult = creaturePoiCheck(game, particle, viewDistanceX, viewDistanceY);
            const dangerNearby = poiResult.typeFound === "poi_danger";
            const foodNearby = poiResult.typeFound === "poi_food";
            let directionX = poiResult.directionX;
            const directionY = poiResult.directionY;
            // If danger is nearby, "panic" (try to move away)
            if (dangerNearby) {
                if (directionX === 0) {
                    directionX = n101random() || 1; // If danger is only vertical, pick a random horizontal direction to move away
                }
                if (directionY > 0) {
                    doJump = true; // If danger is below, try jumping to get away
                }
                particle.bvs1 = directionX; // Store the danger direction in behavior value 1 to run
                particle.bvs2 = 5; // Continue running away for 5 ticks
                moveDirectionX = -directionX; // Move in the opposite direction of the danger
            }
            else if (foodNearby && particle.bvs4 < 80) { // If food is nearby and hunger is below 80, try to move towards it
                if (poiResult.isAdjacent) {
                    creatureEatParticle(game, particle); // If the food is adjacent, eat it instead of moving
                }
                else {
                    if (directionY < 0) {
                        doJump = true; // If food is above, try jumping to reach it
                    }
                }
                moveDirectionX = directionX;
            }
        }
        doJump = doJump || (Math.random() < 0.05); // 5% chance each tick to try jumping even without food above, to add some vertical movement
        if (moveDirectionX !== 0) {
            particleWalkSideways(game, particle, moveDirectionX);
        }
        if (doJump) { // 5% chance each tick to try jumping
            particleJump(game, particle);
        }
    }
    // Gravity
    if (game.canSwap(particle.type, particle.x, particle.y + 1)) {
        game.swapParticles(particle.x, particle.y, particle.x, particle.y + 1);
    }
}
const flightHeightY = 0.1; // Y Level percent of where flying creatures try to stay.
const flightHeightEndY = 0.3; // Y Level percent of where flying creatures try to stay, if they go below this they will try to fly up.
function flyingCreatureBehavior(game, particle, birdLimits = true) {
    const viewDistanceX = 8;
    const viewDistanceY = game.height; // Flying, can see farther up and down (to find food on ground).
    creatureDefaultBehaviors(game, particle);
    if (particle.bvs2 > 0) { // If behavior value 2 is greater than 0, it means the creature is currently trying to run away from danger
        const dangerDirectionX = particle.bvs1;
        const dangerDirectionY = particle.bvs3; // Get the vertical danger direction from behavior value 3
        particle.bvs2--;
        particleWalkSideways(game, particle, -dangerDirectionX); // Fly away from danger direction
        particleFly(game, particle, -dangerDirectionY); // Fly away vertically from danger
    }
    else {
        let moveDirectionX = n101random();
        // Simple flying creature behavior, moves randomly in all directions.
        let moveDirectionY = n101random(false);
        let overrideWantStayHigh = !birdLimits; // Automatically override if using "bird limits"
        if (!game.disableAi) {
            const poiResult = creaturePoiCheck(game, particle, viewDistanceX, viewDistanceY);
            const dangerNearby = poiResult.typeFound === "poi_danger";
            const foodNearby = poiResult.typeFound === "poi_food";
            let directionX = poiResult.directionX;
            const directionY = poiResult.directionY;
            // If danger is nearby, try to move away from it
            if (dangerNearby) {
                if (directionX === 0) {
                    directionX = n101random() || 1; // If danger is only vertical, pick a random horizontal direction to move away
                }
                moveDirectionX = -directionX; // Move in the opposite direction of the danger
                moveDirectionY = -directionY; // Ditto but vertical.
                particle.bvs1 = directionX; // Store the danger direction in behavior value 1 to run
                particle.bvs2 = 5; // Continue running away for 5 ticks
                particle.bvs3 = directionY; // Store the vertical danger direction in behavior value 3 to run
            }
            else if (foodNearby && particle.bvs4 < 80) { // If food is nearby and hunger is below 80, try to move towards it
                console.log;
                if (poiResult.isAdjacent) {
                    creatureEatParticle(game, particle); // If the food is adjacent, eat it instead of moving
                }
                else {
                    moveDirectionX = directionX;
                    moveDirectionY = directionY;
                    overrideWantStayHigh = true; // If the food is not adjacent, override the flying creature's desire to stay at a certain height to try to reach the food, even if it's on the ground
                }
            }
        }
        const startFlightHeight = Math.floor(game.height * flightHeightY);
        const endFlightHeight = Math.floor(game.height * flightHeightEndY);
        if (particle.y < startFlightHeight && !overrideWantStayHigh) {
            // If above flight height, try to fly up
            particleFly(game, particle, -1);
        }
        else if (particle.y > endFlightHeight && !overrideWantStayHigh) {
            // If below flight height, try to fly down
            particleFly(game, particle, 1);
        }
        else {
            // Otherwise, move randomly left or right, and up or down
            if (moveDirectionX !== 0) {
                particleWalkSideways(game, particle, moveDirectionX);
            }
            if (moveDirectionY !== 0) {
                particleFly(game, particle, moveDirectionY);
            }
        }
        particleWalkSideways(game, particle, moveDirectionX); // Try to move sideways as well for more dynamic movement
    }
}
function flyingNonBirdBehavior(game, particle) {
    flyingCreatureBehavior(game, particle, false);
}
powderTypes.addToTag("#edible", "ai_poi");
powderTypes.addToTag("#ai_danger", "ai_poi");
powderTypes.addToTag("#ai_kill", "ai_danger");
powderTypes.register("fallout", {
    name: "Fallout",
    color: "#4f604d",
    colorVariation: 0.1,
    behavior: falloutBehavior, // Fallout from nuclear reactions, heavier than ash and emits radiation particles
    defaultTemp: 22,
    tempTransferRate: 0.05,
    reactions: [
        {
            with: PowderTypes.WATER,
            result: "falloutwater",
            chance: 0.5,
            secondResult: "radiation" // When fallout reacts with water, it has a chance to create a radiation particle in addition to dirty water
        }
    ],
    state: "powder",
    category: "Powders",
    weight: 0.4,
    crushResult: "radioactive_dust", // Fallout crushes into radioactive dust.
    explosionResistance: 0.05, // Same as ash
});
powderTypes.addToTag("fallout", "ai_danger");
powderTypes.register("falloutwater", {
    name: "Fallout Water",
    color: "#3a5f32",
    colorVariation: 0.1,
    behavior: (game, particle) => falloutBehavior(game, particle, liquidBehavior), // Similar to water but with impurities
    defaultTemp: 22,
    tempTransferRate: 0.05,
    reactions: [
        {
            with: PowderTypes.SAND,
            result: "wetsand",
            chance: 0.5,
            secondResult: "fallout" // When fallout water reacts with sand, it has a chance to create an impurity particle (like a small piece of dirt) in addition to wet sand
        }
    ],
    meltingPoint: 110, // When fallout water heats up to 110C or above, it turns to steam
    meltingResult: "fallout_steam",
    meltingResultSecond: "fallout", // When fallout water turns to steam, it has a chance to release an impurity particle (like a small piece of dirt)
    state: "liquid",
    category: "Fluids",
    freezingPoint: -10, // When fallout water cools down to -10C or below, it turns to ice (fallout water has a lower freezing point due to impurities)
    freezingResult: "ice",
    freezingResultSecond: "fallout", // When fallout water turns to ice, it has a chance to release an impurity particle (like a small piece of dirt)
    weight: 0.1, // Heavier than water (water is 0)
    explosionResistance: 0.1, // Only able to resist from impurities
});
powderTypes.addToTag("falloutwater", "ai_danger");
powderTypes.register("fallout_steam", {
    name: "Fallout Steam",
    color: "#2a8053",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        falloutBehavior(game, particle, gasBehavior); // Steam created from fallout water, behaves like a gas but with impurities and emits radiation
        // Chance to become cloud if it rises high enough
        if (Math.random() < 0.01) { // 1% chance each tick to spawn cloud
            if (particle.y < game.height * cloudEndPercent && particle.y > game.height * cloudStartPercent) {
                game.spawnParticle(particle.x, particle.y, "fallout_cloud", true);
            }
        }
    },
    reverseGravity: true,
    gasGravity: true,
    gasWeight: 0.3,
    defaultTemp: 120,
    tempTransferRate: 0.15,
    freezingPoint: 100, // When steam cools down to 100C or below, it turns to water
    freezingResult: "falloutwater",
    state: "gas",
    category: "Gases",
    luminosity: true, // Apply the effect to make it look more diffuse
    weight: -0.1, // Lighter than water
    explosionResistance: 0.0 // ...
});
powderTypes.addToTag("fallout_steam", "ai_danger");
powderTypes.register("poison", {
    name: "Poison",
    color: "#8e11bc",
    colorVariation: 0.1,
    behavior: liquidBehavior, // Toxic liquid that kills creatures (but creatures run away from it)
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "liquid",
    category: "Special",
    weight: 0.1,
});
powderTypes.addToTag("poison", "ai_kill"); // If a creature touches poison, it dies.
powderTypes.register("fallout_cloud", {
    name: "Fallout Cloud",
    color: "#1e5f3a",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        falloutBehavior(game, particle, cloudBehavior);
        // Chance to emit radiation particles within the cloud
        if (Math.random() < 0.01) { // 1% chance each tick to emit radiation
            const directionX = n101random();
            const directionY = n101random();
            if (game.isFree(particle.x + directionX, particle.y + directionY)) {
                game.spawnParticle(particle.x + directionX, particle.y + directionY, "radiation");
            }
        }
        // Another 1% chance to become fallout water OR fallout
        if (Math.random() < 0.01) {
            // Most of the time retain water
            if (Math.random() < 0.25) {
                game.spawnParticle(particle.x, particle.y, "fallout", true);
            }
            else {
                game.spawnParticle(particle.x, particle.y, "falloutwater", true);
            }
        }
    },
    defaultTemp: 100,
    tempTransferRate: 0.1,
    state: "gas",
    category: "Gases",
    luminosity: true, // Apply the effect to make it look more diffuse
    weight: -0.2, // Lighter than fallout steam, rises faster
    reactions: [
        {
            with: "water",
            result: "falloutwater",
            chance: 0.5,
            secondResult: "fallout" // When fallout cloud reacts with water, it has a chance to create fallout particles in addition to fallout water
        }
    ],
    explosionResistance: 0.0 // ...
});
powderTypes.addToTag("fallout_cloud", "ai_danger");
// Please try not to make the comments with life stuff NOT
// very gruesome :X
powderTypes.register("blood", {
    name: "Blood",
    color: "#8a0303",
    colorVariation: 0.1,
    behavior: liquidBehavior,
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "powder",
    category: "Life",
    weight: 0.5,
    meltingPoint: 110, // When blood heats up to 110C or above, it turns into blood steam
    meltingResult: "blood_steam",
    freezingPoint: -5, // When blood cools down to -5C or below, it turns into blood ice
    freezingResult: "blood_ice",
    explosionResistance: 0.0, // Nope.
});
powderTypes.register("blood_steam", {
    name: "Blood Steam",
    color: "#8a0303",
    colorVariation: 0.1,
    behavior: gasBehavior, // Blood steam, created when blood heats up, behaves like a gas but retains the same color and properties as blood
    defaultTemp: 130,
    tempTransferRate: 0.05,
    state: "gas",
    category: "Life",
    weight: 0.5,
    luminosity: true, // Apply the effect to make it look more diffuse like steam
    reverseGravity: true,
    gasGravity: true,
    gasWeight: 0.4,
    freezingPoint: 110, // When blood steam cools down to 110C or below, it turns back into blood
    freezingResult: "blood",
    explosionResistance: 0.0, // Still nope.
});
powderTypes.register("blood_ice", {
    name: "Blood Ice",
    color: "#8a0303",
    colorVariation: 0.1,
    behavior: solidBehavior, // Blood ice, created when blood cools down, behaves like a solid but retains the same color and properties as blood
    defaultTemp: -10,
    tempTransferRate: 0.05,
    state: "solid",
    category: "Life",
    weight: 0.5,
    meltingPoint: -5, // When blood ice heats up to -5C or above, it turns back into blood
    meltingResult: "blood",
    explosionResistance: 0.0, // Still nope.
});
// If it sees blood it thinks a creature would have died there, so danger
powderTypes.addToTag("blood", "ai_danger");
powderTypes.addToTag("blood_steam", "ai_danger");
powderTypes.addToTag("blood_ice", "ai_danger");
powderTypes.register("rat", {
    name: "Rat",
    color: "#4e4444",
    colorVariation: 0.2,
    behavior: landCreatureBehavior,
    onSpawn: creatureOnSpawn,
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "gas", // Never stable to platform on.
    category: "Life",
    weight: 0.5,
    freezingPoint: 10, // Dies at 10C or below, turning into blood
    freezingResult: "blood",
    meltingPoint: 40, // Dies at 40C or above, turning into blood
    meltingResult: "blood",
    crushResult: "blood", // When a rat is crushed (like by a tool), it turns into blood to represent the mess created from crushing the creature
    flammability: 0.01, // Flammable, Can only IMAGINE what players will do with this
    explosionResistance: 0.0 // Why would you even intentionally do this
});
powderTypes.register("bird", {
    name: "Bird",
    color: "#412b1e",
    colorVariation: 0.2,
    behavior: flyingCreatureBehavior,
    onSpawn: creatureOnSpawn,
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "gas", // Never stable to platform on.
    category: "Life",
    weight: 0.3,
    freezingPoint: 10, // Dies at 10C or below, turning into blood
    freezingResult: "blood",
    meltingPoint: 40, // Dies at 40C or above, turning into blood
    meltingResult: "blood",
    crushResult: "blood",
    flammability: 0.01, // Also flammable, because i want to EMBRACE the chaos >:)
    explosionResistance: 0.0 // Why, i ask.
});
powderTypes.register("pyrocumulus", {
    name: "Pyrocumulus Cloud",
    color: "#2c211d",
    colorVariation: 0.1,
    behavior: (game, particle) => {
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
    explosionResistance: 0.0 // ITS A CLOUD 💔
});
powderTypes.addToTag("pyrocumulus", "ai_danger");
powderTypes.addToTag("#molten", "ai_kill"); // Molten stuff with kill creatures
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
    weight: 0.1, // Lighter than regular clouds
    explosionResistance: 0.0 // Still a cloud.
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
    weight: 1.5, // Heavier than regular sand due to water content
    explosionResistance: 0.1 // Slightly resistant to explosions, You can try.
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
    weight: 2, // Heavier than water
    explosionResistance: 0.2 // Slightly resistant to explosions, can withstand some damage
});
powderTypes.addToTag("lava", "molten");
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
    explosionResistance: 0.5 // Stone can resist explosions to some extent, reducing their damage by 0.5 units
});
powderTypes.register("packed_stone", {
    name: "Packed Stone",
    color: "#626262",
    colorVariation: 0.1,
    behavior: solidBehavior, // Solid version of stone
    defaultTemp: 22,
    tempTransferRate: 0.02,
    cliffable: true,
    meltingPoint: 2000, // When packed stone heats up to 2000C or above, it turns to lava
    meltingResult: "lava",
    state: "solid",
    category: "Solids",
    weight: 2.5, // Heavier than stone due to it being compacted
    crushResult: "stone", // When packed stone is crushed (like by a tool), it has a chance to turn into stone instead of just being removed
    explosionResistance: 0.75 // Packed stone can resist explosions better than regular stone, reducing their damage by 0.75 units
});
powderTypes.register("glass", {
    name: "Glass",
    color: "#a0c8f0",
    colorVariation: 0.1,
    behavior: solidBehavior, // A transparent solid that can be melted by heat
    defaultTemp: 22,
    tempTransferRate: 0.05,
    meltingPoint: 1400, // When glass heats up to 1400C or above, it turns to liquid glass
    meltingResult: "liquid_glass",
    state: "solid",
    category: "Solids",
    weight: 2,
    crushResult: "glass_shard", // When glass is crushed (like by a tool), it has a chance to turn into a glass shard (representing the sharp pieces created from breaking the glass).
    explosionResistance: 0.01 // Why would this ever work?
});
powderTypes.register("oxygen", {
    name: "Oxygen",
    color: "#99d9ea",
    colorVariation: 0.1,
    behavior: gasBehavior, // Oxygen gas, supports combustion and can react with certain materials
    defaultTemp: 22,
    tempTransferRate: 0.05,
    reactions: [
        {
            with: "fire",
            result: "fire",
            secondResult: "fire", // When oxygen reacts with fire, it has a chance to create more fire particles to represent the combustion process
            chance: 0.5 // When oxygen reacts with fire, it has a chance to create more fire particles to represent the combustion process
        }
    ],
    state: "gas",
    category: "Gases",
    weight: -0.2, // Lighter than water, so it rises and can swap with other gases to reach the top of the sky
    gasGravity: false, // Not affected by gravity, to make it diffuse in the air
    explosionResistance: 0.0, // The hell you gonna do with OXYGEN
    luminosity: true // Apply the effect to make it look more diffuse in the air, like oxygen is invisible but still has a presence
});
powderTypes.register("carbon_dioxide", {
    name: "Carbon Dioxide",
    color: "#6d6d6d",
    colorVariation: 0.1,
    behavior: gasBehavior, // Carbon dioxide gas, heavier than oxygen and can react with certain materials
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "gas",
    category: "Gases",
    weight: 0.2, // Heavier than oxygen, so it sinks and can displace other gases
    gasGravity: true, // Sinks to the ground
    gasWeight: 0.2, // Heavier than oxygen, so it sinks and can displace other gases
    explosionResistance: 0.0, // The hell you gonna do with CARBON DIOXIDE
    luminosity: true, // Apply the effect to make it look more diffuse in the air, like carbon dioxide is invisible but still has a presence
    reactions: [
        {
            with: "#plant",
            result: "oxygen",
            secondResult: "!original",
            chance: 0.01 // When carbon dioxide reacts with something tagged as plant, it has a chance to turn into oxygen to represent the process of photosynthesis
        }
    ]
});
powderTypes.register("propane", {
    name: "Propane",
    color: "#dfd9c5",
    colorVariation: 0.1,
    behavior: gasBehavior, // Propane gas, flammable and can react with fire
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "gas",
    category: "Gases",
    weight: -0.1, // Lighter than oxygen, so it rises and can swap with other gases to reach the top of the sky
    gasGravity: true, // Rises
    gasWeight: 0.1, // Moves up
    reverseGravity: true,
    flammability: 1.0, // Will spawn fire particles each tick it is on fire
});
powderTypes.register("dead_plant", {
    name: "Dead Plant",
    color: "#654321",
    colorVariation: 0.1,
    behavior: powderBehavior, // Dead plant matter
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "powder",
    category: "Life",
    weight: 0.3,
    crushResult: "dirt", // When dead plant matter is crushed (like by a tool), it has a chance to turn into dirt to represent the decomposition process
    explosionResistance: 0.05 // Slightly resistant to explosions, can withstand some damage
});
powderTypes.register("dirt", {
    name: "Dirt",
    color: "#453425",
    colorVariation: 0.2,
    behavior: powderBehavior, // Dirt, can be created from crushing dead plant matter
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "powder",
    category: "Powders",
    weight: 1.0, // As heavy as sand, Mixes in well and can support creatures
    reactions: [
        {
            with: PowderTypes.WATER,
            result: "mud",
            chance: 0.5 // When dirt reacts with water, it has a chance to turn into mud to represent the process of the water saturating the dirt
        }
    ],
    explosionResistance: 0.05 // Slightly resistant to explosions, can withstand some damage
});
powderTypes.register("mud", {
    name: "Mud",
    color: "#5a3e1b",
    colorVariation: 0.1,
    behavior: liquidBehavior, // Mud behaves like a liquid but can also have reactions to represent the wetness
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "liquid",
    category: "Fluids",
    weight: 0.99, // Make mud go on top of dirt
    explosionResistance: 0.1 // Slightly resistant to explosions, can withstand some damage
});
powderTypes.addToTag("dirt", "growable");
powderTypes.addToTag("dead_plant", "growable");
powderTypes.addToTag("dead_plant", "edible"); // Creatures can eat dead plants.
powderTypes.addToTag("mud", "growable"); // You can grow plants on mud, because it's wet and has nutrients
function plantLivableCheck(game, particle, mustBeOn) {
    const canBeOn = game.processTypeId(mustBeOn);
    const adjacent = game.getAdjacentParticles(particle.x, particle.y);
    for (const adj of adjacent) {
        if (adj && canBeOn.includes(adj.type ?? "")) {
            return true;
        }
    }
    return false;
}
function plantDieNotLivable(game, particle, mustBeOn) {
    if (!plantLivableCheck(game, particle, mustBeOn)) {
        game.spawnParticle(particle.x, particle.y, "dead_plant", true); // If the plant is not on a valid type, it dies and turns into dead plant matter
    }
}
powderTypes.register("grass", {
    name: "Grass",
    color: "#228B22",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        solidBehavior(game, particle); // Grass behaves like a solid to allow creatures to stand on it
        // Chance to spread to adjacent growable particles
        if (Math.random() < 0.05) { // 5% chance each tick to try spreading
            const growDirectionX = n101random(); // Pick random direction to grow in
            const sideParticle = game.getParticle(particle.x + growDirectionX, particle.y);
            if (sideParticle && powderTypes.isTagged(sideParticle.type ?? "", "growable") && game.isFree(particle.x + growDirectionX, particle.y - 1)) {
                game.spawnParticle(particle.x + growDirectionX, particle.y, "grass", true);
            }
            else {
                const belowParticle = game.getParticle(particle.x + growDirectionX, particle.y + 1);
                if (belowParticle && powderTypes.isTagged(belowParticle.type ?? "", "growable") && game.isFree(particle.x + growDirectionX, particle.y)) {
                    game.spawnParticle(particle.x + growDirectionX, particle.y + 1, "grass", true);
                }
                else {
                    const aboveParticle = game.getParticle(particle.x + growDirectionX, particle.y - 1);
                    if (aboveParticle && powderTypes.isTagged(aboveParticle.type ?? "", "growable") && game.isFree(particle.x + growDirectionX, particle.y - 2)) {
                        game.spawnParticle(particle.x + growDirectionX, particle.y - 1, "grass", true);
                    }
                }
            }
        }
        plantDieNotLivable(game, particle, "#growable"); // Has to be on something tagged with growable
    },
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "solid",
    category: "Life",
    weight: 0.9, // Similar to dirt, same for most plants (Stops creatures from swapping)
    explosionResistance: 0.05, // Slightly resistant to explosions, can withstand some damage
    flammability: 0.05, // Flammable, can catch fire and burn away
    burnInto: "ash", // When grass burns, it turns into ash to represent the remains of the burnt plant
    crushResult: "dead_plant" // Crushes into dead plants, which can then become dirt
});
powderTypes.addToTag("grass", "plant");
powderTypes.addToTag("grass", "edible");
powderTypes.addToTag("grass", "growable"); // Plants can grow from grass (also grass can override grass).
powderTypes.register("salt", {
    name: "Salt",
    color: "#ffffff",
    colorVariation: 0.1,
    behavior: powderBehavior, // Salt behaves like a powder
    defaultTemp: 22,
    tempTransferRate: 0.02,
    state: "powder",
    category: "Powders",
    weight: 1.0, // Similar to sand
    explosionResistance: 0.1, // Slightly resistant to explosions
    reactions: [
        {
            with: PowderTypes.WATER,
            result: "salt_water",
            chance: 0.5 // When salt reacts with water, it has a chance to create salt water to represent the process of the salt dissolving in the water
        }
    ]
});
powderTypes.register("salt_water", {
    name: "Salt Water",
    color: "#a0c8f0",
    colorVariation: 0.1,
    behavior: liquidBehavior, // Salt water behaves like a liquid but is heavier than regular water due to the salt content
    defaultTemp: 22,
    tempTransferRate: 0.1,
    meltingPoint: 100, // When salt water heats up to 100C or above, it turns to steam
    meltingResult: PowderTypes.STEAM,
    meltingResultSecond: "salt", // When salt water heats up to 100C or above, it also has a chance to leave behind salt particles to represent the salt residue left after evaporation
    freezingPoint: -5, // When salt water cools down to -5C or below, it turns to ice
    freezingResult: "salt_ice",
    state: "liquid",
    category: "Fluids",
    weight: 0.5, // Heavier than regular water due to salt content
    explosionResistance: 0.0, // Not resistant to explosions
    reactions: [
        {
            with: PowderTypes.SAND,
            result: "wetsand",
            secondResult: "salt", // When salt water reacts with sand, it has a chance to leave behind salt particles to represent the salt residue left in the sand
            chance: 0.5 // When salt water reacts with sand, it has a chance to turn the sand into wet sand to represent the process of the water saturating the sand
        }
    ]
});
powderTypes.register("salt_ice", {
    name: "Salt Ice",
    color: "#6e9ac5",
    colorVariation: 0.1,
    behavior: solidBehavior, // Salt ice, created when salt water cools down, behaves like a solid but is heavier than regular ice due to the salt content
    defaultTemp: -10,
    tempTransferRate: 0.1,
    state: "solid",
    category: "Solids",
    weight: 0.5, // Heavier than regular ice due to salt content
    meltingPoint: -5, // When salt ice heats up to -5C or above, it turns back into salt water
    meltingResult: "salt_water",
    explosionResistance: 0.0 // Not resistant to explosions
});
powderTypes.register("liquid_glass", {
    name: "Liquid Glass",
    color: "#ff9900",
    colorVariation: 0.1,
    behavior: liquidBehavior, // Molten glass, behaves like a liquid but can solidify back into glass when cooled
    defaultTemp: 1500,
    tempTransferRate: 0.1,
    freezingPoint: 1400, // When liquid glass cools down to 1400C or below, it solidifies back into glass
    freezingResult: "glass",
    state: "liquid",
    category: "Fluids",
    weight: 2,
    luminosity: true, // Molten glass emits light
    explosionResistance: 0.0 // Literally worse than normal glass
});
powderTypes.addToTag("liquid_glass", "molten");
powderTypes.register("glass_shard", {
    name: "Glass Shard",
    color: "#a0c8f0",
    colorVariation: 0.2,
    behavior: powderBehavior, // A shard of glass that can be created from crushing glass, behaves like a powder but heavier than regular glass due to its sharp shape
    defaultTemp: 22,
    tempTransferRate: 0.05,
    state: "powder",
    category: "Powders",
    weight: 2.1, // Heavier than regular glass due to its sharp shape
    explosionResistance: 0.005, // Why, just why.
});
powderTypes.addToTag("glass_shard", "ai_danger");
powderTypes.register("gravel", {
    name: "Gravel",
    color: "#606060",
    colorVariation: 0.2,
    behavior: powderBehavior, // Similar to sand but with a chance to be blown by wind (like smoke)
    crushResult: "sand", // When gravel is crushed, it turns into sand
    state: "powder",
    category: "Powders",
    weight: 1.2, // Heavier than sand but lighter than stone
    explosionResistance: 0.15 // At least you are thinking better now
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
    weight: 0, // Waters weight
    explosionResistance: 0.0 // Water is not resistant to explosions
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
    crushResult: "packed_stone", // Bedrock becomes packed stone when crushed.
    explosionResistance: 2.0 // Actually decent choice this time
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
    explosionResistance: 9999 // Wall is virtually indestructible, Made the best choice
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
    weight: -0.1, // Lighter than water
    explosionResistance: 0.0 // ...
});
powderTypes.addToTag("steam", "ai_danger");
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
    explosionResistance: 0.0 // Why would a beam of light EVER save you from an explosion?
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
    weight: 0.1, // Lighter than regular clouds
    explosionResistance: 0.0 // Just smoke bro.
});
powderTypes.addToTag("smoke", "ai_danger");
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
        }
        else if (game.canSwap("fire", particle.x, particle.y + directionY)) {
            game.swapParticles(particle.x, particle.y, particle.x, particle.y + directionY);
        }
        else if (game.canSwap("fire", particle.x + directionX, particle.y)) {
            game.swapParticles(particle.x, particle.y, particle.x + directionX, particle.y);
        }
        const startColor = powderTypes.require("fire").color;
        const endColor = powderTypes.require("smoke").color; // Fire turns to smoke (black) as it cools
        const startTemp = powderTypes.require("fire").defaultTemp;
        const endTemp = powderTypes.require("smoke").defaultTemp;
        const tempRatio = Math.max(0, Math.min(1, (particle.temp - endTemp) / (startTemp - endTemp)));
        particle.deco = colorCurve([
            { offset: 0, color: startColor },
            { offset: 0.25, color: "#ff8000" },
            { offset: 0.75, color: "#FF0000" },
            { offset: 1, color: endColor },
        ], tempRatio);
        const adjacent = game.getAdjacentParticles(particle.x, particle.y);
        for (const adjacentParticle of adjacent) {
            if (adjacentParticle.type === null)
                continue;
            if (adjacentParticle.type === "water" && Math.random() < 0.5) {
                game.removeParticle(adjacentParticle.x, adjacentParticle.y);
            }
            else if (powderTypes.require(adjacentParticle.type).flammability && Math.random() < 0.3) {
                adjacentParticle.lightOnFire();
            }
        }
    },
    defaultTemp: 600,
    tempTransferRate: 0.3,
    luminosity: true,
    freezingPoint: 80, // When fire cools down to 80C or below, it turns to smoke
    freezingResult: "smoke",
    state: "gas",
    category: "Energy",
    weight: -0.2, // Lighter than steam
    explosionResistance: 0.0 // Isnt this literally triggering the explosion???
});
powderTypes.addToTag("fire", "ai_danger");
powderTypes.register("plasma", {
    name: "Plasma",
    color: "#9900ff",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        staticEnergyBehavior(game, particle);
        if (particle.temp < 1000) { // Dissapear if too cold
            game.removeParticle(particle.x, particle.y);
            return;
        }
        const adjacent = game.getAdjacentParticles(particle.x, particle.y);
        for (const adjacentParticle of adjacent) {
            if (adjacentParticle.type === null)
                continue;
            if (powderTypes.require(adjacentParticle.type).flammability && Math.random() < 0.5) {
                adjacentParticle.lightOnFire();
            }
        }
    }, // Super hot ionized gas, behaves like an energy that can transfer heat and ignite flammable materials on contact
    defaultTemp: 5000,
    tempTransferRate: 0.5,
    reactions: [
        {
            with: "fire",
            result: "plasma",
            chance: 0.5 // When plasma reacts with fire, it has a chance to create more plasma particles to represent the intense energy of the reaction
        }
    ],
    luminosity: true,
    state: "energy",
    category: "Energy",
    weight: -1, // Energy has no weight.
    explosionResistance: 0.0, // You are gonna die to the plasma before the explosion 🥀
});
powderTypes.addToTag("plasma", "ai_danger");
powderTypes.register("coal", {
    name: "Coal",
    color: "#2b2b2b",
    colorVariation: 0.1,
    behavior: solidBehavior, // A solid fuel source that can be burned to create fire
    defaultTemp: 22,
    tempTransferRate: 0.05,
    flammability: 0.01, // Can catch fire, but doesnt produce too much fire (Good fuel!)
    meltingPoint: 1000, // When coal heats up to 1000C or above, it turns to fire
    meltingResult: "fire",
    state: "solid",
    category: "Solids",
    weight: 1.5,
    explosionResistance: 0.1 // Okay, thinking again.
});
powderTypes.register("broken_coal", {
    name: "Broken Coal",
    color: "#2b2b2b",
    colorVariation: 0.2,
    behavior: powderBehavior, // Same as coal but powder
    defaultTemp: 22,
    tempTransferRate: 0.05,
    flammability: 0.01, // Can catch fire, but doesnt produce too much fire (Good fuel!)
    meltingPoint: 1000, // When coal heats up to 1000C or above, it turns to fire
    meltingResult: "fire",
    state: "powder",
    category: "Powders",
    weight: 1.5,
    explosionResistance: 0.01 // Why.
});
powderTypes.register("radiation", {
    name: "Radiation",
    color: "#00ff00",
    colorVariation: 0.25,
    behavior: (game, particle) => {
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
    explosionResistance: 0.0 // WHAT THE HELL ARE YOU DOING
});
powderTypes.addToTag("radiation", "ai_kill");
powderTypes.register("crusher", {
    name: "Crusher",
    color: "#888888",
    colorVariation: 0.2,
    behavior: (game, particle) => {
        const adajcentParticles = game.getAdjacentParticles(particle.x, particle.y);
        for (const adjacent of adajcentParticles) {
            game.crushParticle(adjacent.x, adjacent.y);
        }
        particle.deco = particle.generateColorVariation();
    },
    defaultTemp: 22,
    tempTransferRate: 0.01,
    state: "solid",
    category: "Special",
    weight: 9999, // Effectively immovable
    crushResult: null, // Crusher cannot be crushed
    explosionResistance: 2.0 // Pray you dont get thrown to the wall.
});
powderTypes.addToTag("crusher", "ai_danger");
// Already kills via crushing, no need to add to ai_kill
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
    // Explosive dust (producing fire every tick while burning)
    flammability: 1.0, // Dust can catch fire, creating a small explosion and turning into smoke
    explosionResistance: 0.0 // ..really
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
    explosionResistance: 0.0 // Same thing as dust.
});
powderTypes.addToTag("radioactive_dust", "ai_danger");
// Version 1.0.0 additions
powderTypes.register("neutron", {
    name: "Neutron",
    color: "#00ffff",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        energyBehavior(game, particle);
    },
    defaultTemp: 0,
    tempTransferRate: 0,
    state: "energy",
    category: "Radioactive",
    weight: -1, // Energy has no weight.
    explosionResistance: 0.0, // You are gonna die to the neutron before the explosion 🥀
    reactions: [
        {
            with: "proton",
            result: "hydrogen",
            chance: 0.05 // When a neutron reacts with a proton, it has a small chance to create hydrogen
        }
    ]
});
powderTypes.addToTag("neutron", "ai_kill");
powderTypes.register("proton", {
    name: "Proton",
    color: "#ff0000",
    colorVariation: 0.1,
    behavior: (game, particle) => {
        energyBehavior(game, particle);
    },
    defaultTemp: 0,
    tempTransferRate: 0,
    state: "energy",
    category: "Radioactive",
    weight: -1, // Energy has no weight.
    explosionResistance: 0.0 // You are gonna die to the proton before the explosion 🥀
});
powderTypes.addToTag("proton", "ai_kill");
powderTypes.register("hydrogen", {
    name: "Hydrogen",
    color: "#598cb7",
    colorVariation: 0.1,
    behavior: gasBehavior, // Hydrogen gas, lighter than air and can react with oxygen to create water
    defaultTemp: 0,
    tempTransferRate: 0,
    state: "gas",
    category: "Gases",
    weight: -0.4, // Lightest known gas, so it is VERY light
    explosionResistance: 0.0, // Literally flammable gas
    reactions: [
        {
            with: "oxygen",
            result: "water",
            chance: 0.02 // When hydrogen reacts with oxygen, it has a chance to create water to represent the chemical reaction of hydrogen combusting in oxygen to create water
        }
    ],
    flammability: 1.0, // Extremely flammable, can ignite and cause explosions when in contact with fire or sparks
    gasGravity: true, // Rises
    gasWeight: 0.4, // Rises with a 40% chance each tick
    reverseGravity: true,
});
// Vanilla tools (From version BETA)
toolTypes.register("heat", {
    name: "Heat Tool",
    color: "#ff0000",
    action: (game, x, y) => {
        if (!game.mouseLeftDown)
            return;
        const halfBrushSize = Math.floor(game.brushSize / 2);
        const particles = game.getParticlesInSquare(x - halfBrushSize, y - halfBrushSize, game.brushSize, game.brushSize);
        for (const particle of particles) {
            particle.temp += game.intensifyBrush ? 20 : 10; // Increase temperature by 10 degrees Celsius per tick
        }
    },
    onTick: true,
});
toolTypes.register("superheat", {
    name: "Superheat Tool",
    color: "#ff4000",
    action: (game, x, y) => {
        if (!game.mouseLeftDown)
            return;
        const halfBrushSize = Math.floor(game.brushSize / 2);
        const particles = game.getParticlesInSquare(x - halfBrushSize, y - halfBrushSize, game.brushSize, game.brushSize);
        for (const particle of particles) {
            particle.temp += game.intensifyBrush ? 200 : 100; // Increase temperature by 100 or 200 degrees Celsius per tick
        }
    },
    onTick: true,
});
toolTypes.register("exsuperheat", {
    name: "Extreme Superheat Tool",
    color: "#d84242",
    action: (game, x, y) => {
        if (!game.mouseLeftDown)
            return;
        const halfBrushSize = Math.floor(game.brushSize / 2);
        const particles = game.getParticlesInSquare(x - halfBrushSize, y - halfBrushSize, game.brushSize, game.brushSize);
        for (const particle of particles) {
            particle.temp += game.intensifyBrush ? 750 : 375; // Increase temperature by 375 or 750`` degrees Celsius per tick
        }
    },
    onTick: true,
});
toolTypes.register("supercool", {
    name: "Supercool Tool",
    color: "#0095ff",
    action: (game, x, y) => {
        if (!game.mouseLeftDown)
            return;
        const halfBrushSize = Math.floor(game.brushSize / 2);
        const particles = game.getParticlesInSquare(x - halfBrushSize, y - halfBrushSize, game.brushSize, game.brushSize);
        for (const particle of particles) {
            particle.temp -= game.intensifyBrush ? 200 : 100; // Decrease temperature by 100 or 200 degrees Celsius per tick
        }
    },
    onTick: true,
});
toolTypes.register("cool", {
    name: "Cool Tool",
    color: "#0000ff",
    action: (game, x, y) => {
        if (!game.mouseLeftDown)
            return;
        const halfBrushSize = Math.floor(game.brushSize / 2);
        const particles = game.getParticlesInSquare(x - halfBrushSize, y - halfBrushSize, game.brushSize, game.brushSize);
        for (const particle of particles) {
            particle.temp -= game.intensifyBrush ? 20 : 10; // Decrease temperature by 10 or 20 degrees Celsius per tick
        }
    },
    onTick: true
});
toolTypes.register("roomtemp", {
    name: "Room Temperature Tool",
    color: "#d0b067",
    action: (game, x, y) => {
        if (!game.mouseLeftDown)
            return;
        const halfBrushSize = Math.floor(game.brushSize / 2);
        const particles = game.getParticlesInSquare(x - halfBrushSize, y - halfBrushSize, game.brushSize, game.brushSize);
        for (const particle of particles) {
            particle.temp = 22; // Set temperature to room temperature (22C)
        }
    },
    onTick: true
});
toolTypes.register("eyedropper", {
    name: "Pick Tool",
    color: "#ffffff",
    action: (game, x, y) => {
        if (!game.mouseLeftDown)
            return; // Only pick when left mouse button is held down
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
        if (!game.mouseLeftDown)
            return;
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
        if (!game.mouseLeftDown)
            return;
        const particles = game.getParticlesInSquare(x - game.brushSize, y - game.brushSize, (game.brushSize * 2) + 1, (game.brushSize * 2) + 1);
        for (const particle of particles) {
            if (game.intensifyBrush) {
                game.crushParticle(particle.x, particle.y);
                game.crushParticle(particle.x, particle.y); // Crush twice for intensified brush
            }
            else {
                game.crushParticle(particle.x, particle.y);
            }
        }
    },
    onTick: true
});
// For mobile users
toolTypes.register("erase", {
    name: "Erase Tool",
    color: "#ffffff",
    action: (game, x, y) => {
        if (!game.mouseLeftDown)
            return;
        game.drawParticleLine(game.lastMouseX, game.lastMouseY, x, y, null, true, game.brushSize); // Draw with null type to erase particles
    },
    onTick: false
});
export default {
    startGame,
    getGame,
    Powders,
    Particle
};
//# sourceMappingURL=powders.js.map