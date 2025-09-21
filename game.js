// Game client for Mini MMORPG
class GameClient {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.worldImage = null;
    this.worldSize = 2048; // World map is 2048x2048 pixels

    // WebSocket connection
    this.socket = null;
    this.serverUrl = "wss://codepath-mmorg.onrender.com";

    // Game state
    this.myPlayerId = null;
    this.players = {};
    this.avatars = {};
    this.avatarImages = {}; // Cached avatar images

    // Viewport/camera
    this.viewport = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };

    // Movement controls
    this.pressedKeys = {};
    this.isMoving = false;
    this.currentDirection = null;
    this.movementInterval = null;
    this.movementIntervalMs = 100; // Send move command every 100ms

    // NPC system
    this.npcs = {};
    this.npcCount = 6;
    this.npcMovementInterval = null;
    this.npcsCreated = false;

    // Inventory and trading system
    this.inventory = new Array(9).fill(null); // 9 empty slots
    this.nearbyNPC = null;
    this.showTradePrompt = false;
    this.tradeMessage = "";
    this.tradeMessageTimer = 0;

    this.init();
  }

  init() {
    this.setupCanvas();
    this.loadWorldMap();
    this.setupKeyboardControls();
    this.connectToServer();
  }

  setupCanvas() {
    // Set canvas size to fill the browser window
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Update viewport size
    this.viewport.width = this.canvas.width;
    this.viewport.height = this.canvas.height;

    // Handle window resize
    window.addEventListener("resize", () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.viewport.width = this.canvas.width;
      this.viewport.height = this.canvas.height;
      this.updateViewport();
      this.draw();
    });
  }

  loadWorldMap() {
    this.worldImage = new Image();
    this.worldImage.onload = () => {
      this.draw();
    };
    this.worldImage.onerror = () => {
      console.error("Failed to load world map image");
    };
    this.worldImage.src = "world.jpg";
  }

  setupKeyboardControls() {
    // Add keyboard event listeners
    document.addEventListener("keydown", (event) => {
      this.handleKeyDown(event);
    });

    document.addEventListener("keyup", (event) => {
      this.handleKeyUp(event);
    });

    // Prevent default behavior for arrow keys to avoid page scrolling
    document.addEventListener("keydown", (event) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
      }
    });
  }

  handleKeyDown(event) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const key = event.key;
    const direction = this.getDirectionFromKey(key);

    if (direction && !this.pressedKeys[key]) {
      this.pressedKeys[key] = true;
      this.startContinuousMovement();
    } else if (key === "t" || key === "T") {
      // Handle trading
      this.handleTradeKey();
    }
  }

  handleKeyUp(event) {
    const key = event.key;
    const direction = this.getDirectionFromKey(key);

    if (direction && this.pressedKeys[key]) {
      delete this.pressedKeys[key];
      this.updateMovementState();
    }
  }

  getDirectionFromKey(key) {
    const keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    return keyMap[key] || null;
  }

  sendMoveCommand(direction) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const moveMessage = {
      action: "move",
      direction: direction,
    };

    this.socket.send(JSON.stringify(moveMessage));
    this.currentDirection = direction;
    this.isMoving = true;
  }

  sendStopCommand() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const stopMessage = {
      action: "stop",
    };

    this.socket.send(JSON.stringify(stopMessage));
    this.isMoving = false;
    this.currentDirection = null;
  }

  updateMovementState() {
    // Check if any movement keys are still pressed
    const hasMovementKeys = Object.keys(this.pressedKeys).some((key) =>
      this.getDirectionFromKey(key)
    );

    if (!hasMovementKeys && this.isMoving) {
      this.stopContinuousMovement();
    }
  }

  startContinuousMovement() {
    // Clear any existing movement interval
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
    }

    // Start continuous movement
    this.movementInterval = setInterval(() => {
      this.sendContinuousMoveCommand();
    }, this.movementIntervalMs);
  }

  stopContinuousMovement() {
    // Clear movement interval
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
    }

    // Send stop command
    this.sendStopCommand();
  }

  sendContinuousMoveCommand() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    // Get the primary direction from pressed keys
    const primaryDirection = this.getPrimaryDirection();
    if (primaryDirection) {
      this.sendMoveCommand(primaryDirection);
    }
  }

  getPrimaryDirection() {
    // Priority order: up, down, left, right
    const priority = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

    for (const key of priority) {
      if (this.pressedKeys[key]) {
        return this.getDirectionFromKey(key);
      }
    }

    return null;
  }

  connectToServer() {
    try {
      this.socket = new WebSocket(this.serverUrl);

      this.socket.onopen = () => {
        console.log("Connected to game server");
        this.joinGame();
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleServerMessage(message);
        } catch (error) {
          console.error("Failed to parse server message:", error);
        }
      };

      this.socket.onclose = () => {
        console.log("Disconnected from game server");
        this.stopContinuousMovement();
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to connect to server:", error);
    }
  }

  joinGame() {
    const joinMessage = {
      action: "join_game",
      username: "Tim",
    };

    this.socket.send(JSON.stringify(joinMessage));
    console.log("Sent join_game message");
  }

  handleServerMessage(message) {
    console.log("Received message:", message);

    switch (message.action) {
      case "join_game":
        if (message.success) {
          this.myPlayerId = message.playerId;
          this.players = message.players;
          this.avatars = message.avatars;
          this.loadAvatarImages();
          this.centerOnMyPlayer();
          this.draw();
        } else {
          console.error("Join game failed:", message.error);
        }
        break;

      case "player_joined":
        console.log(`Player joined: ${message.player.username}`);
        this.players[message.player.id] = message.player;
        this.avatars[message.avatar.name] = message.avatar;
        this.loadAvatarImage(message.avatar);
        this.draw();
        break;

      case "players_moved":
        const movedPlayers = Object.keys(message.players);
        if (movedPlayers.length > 0) {
          console.log(`Players moved: ${movedPlayers.length} players`);
        }
        Object.assign(this.players, message.players);
        // Update viewport if my player moved
        if (this.myPlayerId && message.players[this.myPlayerId]) {
          this.updateViewport();
        }
        this.draw();
        break;

      case "player_left":
        delete this.players[message.playerId];
        this.draw();
        break;

      default:
        console.log("Unknown message type:", message.action);
    }
  }

  loadAvatarImages() {
    for (const avatarName in this.avatars) {
      this.loadAvatarImage(this.avatars[avatarName]);
    }

    // Check if we can create NPCs now
    this.checkAndCreateNPCs();
  }

  loadAvatarImage(avatar) {
    const avatarKey = avatar.name;
    this.avatarImages[avatarKey] = {};
    let loadedFrames = 0;
    const totalFrames = Object.values(avatar.frames).reduce(
      (sum, frames) => sum + frames.length,
      0
    );

    // Load each direction's frames
    for (const direction in avatar.frames) {
      this.avatarImages[avatarKey][direction] = [];

      avatar.frames[direction].forEach((base64Data, index) => {
        const img = new Image();
        img.onload = () => {
          this.avatarImages[avatarKey][direction][index] = img;
          loadedFrames++;

          // Check if all frames for this avatar are loaded
          if (loadedFrames === totalFrames) {
            console.log(`Avatar ${avatarKey} fully loaded`);
            this.checkAndCreateNPCs();
          }

          this.draw(); // Redraw when new avatar loads
        };
        img.src = base64Data;
      });
    }
  }

  centerOnMyPlayer() {
    if (!this.myPlayerId || !this.players[this.myPlayerId]) return;

    const myPlayer = this.players[this.myPlayerId];

    // Center viewport on my player
    this.viewport.x = myPlayer.x - this.viewport.width / 2;
    this.viewport.y = myPlayer.y - this.viewport.height / 2;

    // Clamp viewport to world bounds
    this.viewport.x = Math.max(
      0,
      Math.min(this.viewport.x, this.worldSize - this.viewport.width)
    );
    this.viewport.y = Math.max(
      0,
      Math.min(this.viewport.y, this.worldSize - this.viewport.height)
    );
  }

  updateViewport() {
    if (this.myPlayerId && this.players[this.myPlayerId]) {
      this.centerOnMyPlayer();
    }
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX - this.viewport.x,
      y: worldY - this.viewport.y,
    };
  }

  isInViewport(worldX, worldY, margin = 100) {
    return (
      worldX >= this.viewport.x - margin &&
      worldX <= this.viewport.x + this.viewport.width + margin &&
      worldY >= this.viewport.y - margin &&
      worldY <= this.viewport.y + this.viewport.height + margin
    );
  }

  draw() {
    this.drawWorld();
    this.drawAvatars();
    this.drawUI();
  }

  drawWorld() {
    if (!this.worldImage) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw the world map section visible in viewport
    this.ctx.drawImage(
      this.worldImage,
      this.viewport.x,
      this.viewport.y,
      this.viewport.width,
      this.viewport.height, // Source: viewport area
      0,
      0,
      this.viewport.width,
      this.viewport.height // Destination: full canvas
    );
  }

  drawAvatars() {
    // Draw real players
    for (const playerId in this.players) {
      const player = this.players[playerId];

      // Only draw avatars in viewport
      if (!this.isInViewport(player.x, player.y)) continue;

      const screenPos = this.worldToScreen(player.x, player.y);
      this.drawAvatar(player, screenPos.x, screenPos.y);
    }

    // Draw NPCs
    for (const npcId in this.npcs) {
      const npc = this.npcs[npcId];

      // Only draw avatars in viewport
      if (!this.isInViewport(npc.x, npc.y)) continue;

      const screenPos = this.worldToScreen(npc.x, npc.y);
      this.drawAvatar(npc, screenPos.x, screenPos.y);
    }
  }

  drawAvatar(player, screenX, screenY) {
    const avatar = this.avatars[player.avatar];
    if (!avatar || !this.avatarImages[player.avatar]) {
      // Draw a placeholder circle for missing avatars
      this.ctx.fillStyle = "red";
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, 16, 0, Math.PI * 2);
      this.ctx.fill();
      this.drawUsernameLabel(player.username, screenX, screenY - 20);
      return;
    }

    const direction = player.facing;
    const frameIndex = Math.floor(player.animationFrame || 0);

    // Handle west direction by using east frames and flipping
    let actualDirection = direction;
    let shouldFlip = false;
    if (direction === "west") {
      actualDirection = "east";
      shouldFlip = true;
    }

    // Get the avatar image for this direction and frame
    const avatarImages = this.avatarImages[player.avatar][actualDirection];
    if (!avatarImages || !avatarImages[frameIndex]) {
      // Draw a placeholder circle for missing avatar frames
      this.ctx.fillStyle = "blue";
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, 16, 0, Math.PI * 2);
      this.ctx.fill();
      this.drawUsernameLabel(player.username, screenX, screenY - 20);
      return;
    }

    const img = avatarImages[frameIndex];

    // Calculate avatar size (maintain aspect ratio)
    const avatarSize = 32; // Base size
    const aspectRatio = img.width / img.height;
    let width = avatarSize;
    let height = avatarSize / aspectRatio;

    // Center the avatar on the player position
    const x = screenX - width / 2;
    const y = screenY - height;

    // Save canvas state for transformations
    this.ctx.save();

    if (shouldFlip) {
      // Flip horizontally for west direction
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(img, -x - width, y, width, height);
    } else {
      // Draw avatar normally
      this.ctx.drawImage(img, x, y, width, height);
    }

    // Restore canvas state
    this.ctx.restore();

    // Draw username label
    this.drawUsernameLabel(player.username, screenX, y - 5);
  }

  drawUsernameLabel(username, x, y) {
    // Set text style
    this.ctx.fillStyle = "white";
    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = 2;
    this.ctx.font = "12px Arial";
    this.ctx.textAlign = "center";

    // Draw text with outline
    this.ctx.strokeText(username, x, y);
    this.ctx.fillText(username, x, y);
  }

  checkAndCreateNPCs() {
    // Only create NPCs once
    if (this.npcsCreated) {
      return;
    }

    // Check if player avatar is available and loaded
    const myPlayer = this.myPlayerId ? this.players[this.myPlayerId] : null;
    const playerAvatar = myPlayer ? myPlayer.avatar : null;

    if (!playerAvatar) {
      console.log("No player avatar available for NPCs");
      return;
    }

    // Check if avatar images are loaded
    if (!this.avatarImages[playerAvatar]) {
      console.log("Player avatar images not loaded yet");
      return;
    }

    // Check if all directions have frames loaded
    const avatarData = this.avatarImages[playerAvatar];
    const requiredDirections = ["north", "south", "east"];
    for (const direction of requiredDirections) {
      if (!avatarData[direction] || avatarData[direction].length === 0) {
        console.log(`Avatar direction ${direction} not loaded yet`);
        return;
      }
    }

    console.log("All avatar images loaded, creating NPCs");
    this.createNPCs();
  }

  createNPCs() {
    // Only create NPCs once
    if (this.npcsCreated) {
      return;
    }

    const npcNames = [
      "Alice",
      "Bob",
      "Charlie",
      "Diana",
      "Eve",
      "Frank",
      "Grace",
      "Henry",
    ];

    // Use the same avatar as the player character
    const myPlayer = this.myPlayerId ? this.players[this.myPlayerId] : null;
    const playerAvatar = myPlayer ? myPlayer.avatar : null;

    if (!playerAvatar) {
      console.log("No player avatar available for NPCs");
      return;
    }

    console.log(`Creating ${this.npcCount} NPCs with avatar: ${playerAvatar}`);

    for (let i = 0; i < this.npcCount; i++) {
      const npcId = `npc_${i}`;
      const npcName = npcNames[i % npcNames.length];

      // Random position in the world (avoid edges)
      const x = Math.random() * (this.worldSize - 200) + 100;
      const y = Math.random() * (this.worldSize - 200) + 100;

      this.npcs[npcId] = {
        id: npcId,
        username: npcName,
        x: x,
        y: y,
        avatar: playerAvatar, // Use same avatar as player
        facing: "south",
        isMoving: false,
        animationFrame: 0,
        targetX: x,
        targetY: y,
        moveTimer: 0,
        moveInterval: 2000 + Math.random() * 3000, // 2-5 seconds between moves
        moveSpeed: 1 + Math.random() * 2, // 1-3 pixels per frame
      };
    }

    this.npcsCreated = true;
    console.log(
      `Successfully created ${this.npcCount} NPCs with player avatar`
    );
    this.startNPCMovement();
  }

  startNPCMovement() {
    if (this.npcMovementInterval) {
      clearInterval(this.npcMovementInterval);
    }

    this.npcMovementInterval = setInterval(() => {
      this.updateNPCs();
    }, 50); // Update NPCs every 50ms for smooth movement
  }

  updateNPCs() {
    let needsRedraw = false;

    for (const npcId in this.npcs) {
      const npc = this.npcs[npcId];

      // Update move timer
      npc.moveTimer += 50;

      // Check if it's time to set a new target
      if (npc.moveTimer >= npc.moveInterval) {
        this.setNPCTarget(npc);
        npc.moveTimer = 0;
        npc.moveInterval = 2000 + Math.random() * 3000; // New random interval
        needsRedraw = true;
      }

      // Move towards target
      const oldX = npc.x;
      const oldY = npc.y;
      this.moveNPCTowardsTarget(npc);

      // Only redraw if position actually changed
      if (Math.abs(npc.x - oldX) > 0.1 || Math.abs(npc.y - oldY) > 0.1) {
        needsRedraw = true;
      }
    }

    // Check for nearby NPCs for trading
    this.checkForNearbyNPCs();

    // Update trade message timer
    if (this.tradeMessageTimer > 0) {
      this.tradeMessageTimer -= 50;
      if (this.tradeMessageTimer <= 0) {
        this.tradeMessage = "";
      }
    }

    // Always redraw to ensure NPCs are visible (temporary fix)
    this.draw();
  }

  setNPCTarget(npc) {
    // Set a new random target position
    const distance = 100 + Math.random() * 200; // 100-300 pixels away
    const angle = Math.random() * Math.PI * 2;

    npc.targetX = npc.x + Math.cos(angle) * distance;
    npc.targetY = npc.y + Math.sin(angle) * distance;

    // Clamp to world bounds
    npc.targetX = Math.max(50, Math.min(npc.targetX, this.worldSize - 50));
    npc.targetY = Math.max(50, Math.min(npc.targetY, this.worldSize - 50));

    // Set facing direction
    const dx = npc.targetX - npc.x;
    const dy = npc.targetY - npc.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      npc.facing = dx > 0 ? "east" : "west";
    } else {
      npc.facing = dy > 0 ? "south" : "north";
    }

    npc.isMoving = true;
  }

  moveNPCTowardsTarget(npc) {
    const dx = npc.targetX - npc.x;
    const dy = npc.targetY - npc.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) {
      // Reached target
      npc.x = npc.targetX;
      npc.y = npc.targetY;
      npc.isMoving = false;
      npc.animationFrame = 0;
    } else {
      // Move towards target
      const moveX = (dx / distance) * npc.moveSpeed;
      const moveY = (dy / distance) * npc.moveSpeed;

      npc.x += moveX;
      npc.y += moveY;

      // Animate walking
      npc.animationFrame = (npc.animationFrame + 0.2) % 3;
    }
  }

  checkForNearbyNPCs() {
    if (!this.myPlayerId || !this.players[this.myPlayerId]) return;

    const myPlayer = this.players[this.myPlayerId];
    const tradeDistance = 80; // Distance to show trade prompt

    this.nearbyNPC = null;
    this.showTradePrompt = false;

    for (const npcId in this.npcs) {
      const npc = this.npcs[npcId];
      const distance = Math.sqrt(
        Math.pow(npc.x - myPlayer.x, 2) + Math.pow(npc.y - myPlayer.y, 2)
      );

      if (distance <= tradeDistance) {
        this.nearbyNPC = npc;
        this.showTradePrompt = true;
        break;
      }
    }
  }

  handleTradeKey() {
    if (this.nearbyNPC && this.showTradePrompt) {
      // Check if player has anything to trade
      const hasItems = this.inventory.some((item) => item !== null);

      if (hasItems) {
        this.tradeMessage = "Trading system not implemented yet!";
      } else {
        this.tradeMessage = "You have nothing to trade";
      }

      this.tradeMessageTimer = 3000; // Show message for 3 seconds
    }
  }

  drawInventory() {
    // Save current transform
    this.ctx.save();

    // Use CSS pixels for consistent sizing regardless of zoom
    const slotSize = 50;
    const slotSpacing = 5;
    const totalWidth = (slotSize + slotSpacing) * 9 - slotSpacing;

    // Get the actual display size of the canvas (CSS pixels)
    const canvasRect = this.canvas.getBoundingClientRect();
    const displayWidth = canvasRect.width;
    const displayHeight = canvasRect.height;

    const startX = (displayWidth - totalWidth) / 2;
    const startY = displayHeight - slotSize - 20;

    // Reset transform to use CSS pixels
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw inventory background
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(startX - 10, startY - 10, totalWidth + 20, slotSize + 20);

    // Draw inventory slots
    for (let i = 0; i < 9; i++) {
      const x = startX + i * (slotSize + slotSpacing);
      const y = startY;

      // Draw slot background
      this.ctx.fillStyle = "rgba(100, 100, 100, 0.8)";
      this.ctx.fillRect(x, y, slotSize, slotSize);

      // Draw slot border
      this.ctx.strokeStyle = "white";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, slotSize, slotSize);

      // Draw slot number
      this.ctx.fillStyle = "white";
      this.ctx.font = "12px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText((i + 1).toString(), x + slotSize / 2, y + slotSize - 5);

      // Draw item if exists (currently all slots are empty)
      if (this.inventory[i]) {
        // Future: draw item icon here
        this.ctx.fillStyle = "gold";
        this.ctx.fillRect(x + 5, y + 5, slotSize - 10, slotSize - 10);
      }
    }

    // Restore transform
    this.ctx.restore();
  }

  drawTradePrompt() {
    if (!this.showTradePrompt || !this.nearbyNPC) return;

    // Draw trade prompt above nearby NPC
    const screenPos = this.worldToScreen(this.nearbyNPC.x, this.nearbyNPC.y);
    const text = `Press T to trade with ${this.nearbyNPC.username}`;

    // Set font to measure text width
    this.ctx.font = "14px Arial";
    this.ctx.textAlign = "center";
    const textWidth = this.ctx.measureText(text).width;
    const padding = 20;
    const backgroundWidth = textWidth + padding;
    const backgroundHeight = 30;

    // Draw background with proper width
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.ctx.fillRect(
      screenPos.x - backgroundWidth / 2,
      screenPos.y - 60,
      backgroundWidth,
      backgroundHeight
    );

    // Draw text
    this.ctx.fillStyle = "white";
    this.ctx.fillText(text, screenPos.x, screenPos.y - 40);
  }

  drawTradeMessage() {
    if (!this.tradeMessage) return;

    // Draw trade message in center of screen
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.ctx.fillRect(
      this.canvas.width / 2 - 150,
      this.canvas.height / 2 - 20,
      300,
      40
    );

    this.ctx.fillStyle = "white";
    this.ctx.font = "16px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      this.tradeMessage,
      this.canvas.width / 2,
      this.canvas.height / 2 + 5
    );
  }

  drawUI() {
    // Draw player count and position info
    const playerCount = Object.keys(this.players).length;
    const npcCount = Object.keys(this.npcs).length;
    const totalCount = playerCount + npcCount;
    const myPlayer = this.myPlayerId ? this.players[this.myPlayerId] : null;

    // Set text style for UI
    this.ctx.fillStyle = "white";
    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = 2;
    this.ctx.font = "14px Arial";
    this.ctx.textAlign = "left";

    // Draw player count
    const playerCountText = `Players: ${playerCount} | NPCs: ${npcCount} | Total: ${totalCount}`;
    this.ctx.strokeText(playerCountText, 10, 25);
    this.ctx.fillText(playerCountText, 10, 25);

    // Draw my position
    if (myPlayer) {
      const positionText = `Position: (${Math.round(myPlayer.x)}, ${Math.round(
        myPlayer.y
      )})`;
      this.ctx.strokeText(positionText, 10, 45);
      this.ctx.fillText(positionText, 10, 45);
    }

    // Draw viewport info
    const viewportText = `Viewport: (${Math.round(
      this.viewport.x
    )}, ${Math.round(this.viewport.y)})`;
    this.ctx.strokeText(viewportText, 10, 65);
    this.ctx.fillText(viewportText, 10, 65);

    // Draw instructions
    this.ctx.font = "12px Arial";
    const instructions = "Use arrow keys to move • Press T near NPCs to trade!";
    this.ctx.strokeText(instructions, 10, this.canvas.height - 10);
    this.ctx.fillText(instructions, 10, this.canvas.height - 10);

    // Draw trading UI elements
    this.drawInventory();
    this.drawTradePrompt();
    this.drawTradeMessage();
  }
}

// Initialize the game when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new GameClient();
});
