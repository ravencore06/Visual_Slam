class MiniMap {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.path = []; // Array of {x, y}
        this.target = null; // {x, y}
        this.scale = 20; // pixels per meter

        // Center the map initially
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
    }

    update(userPos) {
        // Add current position to path
        // Optimization: Only add if moved significantly
        const last = this.path[this.path.length - 1];
        if (!last || Math.hypot(userPos.x - last.x, userPos.y - last.y) > 0.1) {
            this.path.push({ x: userPos.x, y: userPos.y });
        }

        this.draw(userPos);
    }

    setTarget(x, y) {
        this.target = { x, y };
    }

    draw(userPos) {
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.ctx.save();
        // Transform so user is always at center, facing UP
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(-userPos.heading); // Rotate map opposite to user heading
        this.ctx.scale(this.scale, this.scale);
        this.ctx.translate(-userPos.x, -userPos.y); // Move world so user is at origin

        // Draw Grid (Optional, for reference)
        this.drawGrid();

        // Draw Target
        if (this.target) {
            this.ctx.fillStyle = '#00FF00';
            this.ctx.beginPath();
            this.ctx.arc(this.target.x, this.target.y, 0.3, 0, Math.PI * 2);
            this.ctx.fill();
            // Pulse effect could go here
        }

        // Draw Path
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        this.ctx.lineWidth = 0.1;
        this.ctx.beginPath();
        if (this.path.length > 0) {
            this.ctx.moveTo(this.path[0].x, this.path[0].y);
            for (let i = 1; i < this.path.length; i++) {
                this.ctx.lineTo(this.path[i].x, this.path[i].y);
            }
        }
        this.ctx.stroke();

        this.ctx.restore();

        // Draw User Icon (Fixed at center)
        this.drawUserIcon();
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 0.05;
        const size = 10; // Draw 10m around
        // This is tricky with infinite scrolling, simplified for now:
        // Just draw a cross at origin (0,0)
        this.ctx.beginPath();
        this.ctx.moveTo(-1, 0); this.ctx.lineTo(1, 0);
        this.ctx.moveTo(0, -1); this.ctx.lineTo(0, 1);
        this.ctx.stroke();
    }

    drawUserIcon() {
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -10); // Tip
        this.ctx.lineTo(7, 10);
        this.ctx.lineTo(0, 5); // Indent
        this.ctx.lineTo(-7, 10);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }
}
