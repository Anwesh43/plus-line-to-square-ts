const w : number = window.innerWidth
const h : number = window.innerHeight
const scGap : number = 0.05
const scDiv : number = 0.51
const strokeFactor : number = 90
const sizeFactor : number = 2.9
const nodes : number = 5
const lines : number = 4
const deg : number = Math.PI / 4
const foreColor : string = "#311B92"
const backColor : string = "#BDBDBD"
const parts : number = 2

class ScaleUtil {

    static maxScale(scale : number, i : number, n : number) : number {
        return Math.max(0, scale - i / n)
    }

    static divideScale(scale : number, i : number, n : number) : number {
        return Math.min(1 / n, ScaleUtil.maxScale(scale, i, n)) * n
    }

    static scaleFactor(scale : number) : number {
        return Math.floor(scale / scDiv)
    }

    static mirrorValue(scale : number, a : number, b : number) : number {
        const k : number = ScaleUtil.scaleFactor(scale)
        return (1 - k) / a + k / b
    }

    static updateValue(scale : number, dir : number, a : number, b : number) : number {
        return ScaleUtil.mirrorValue(scale, a, b) * dir * scGap
    }
}

class DrawingUtil {

    static drawLine(context : CanvasRenderingContext2D, x1 : number, y1 : number, x2 : number, y2 : number) {
        if (x1 == 0 && x2 == 0 && y2 == 0 && y1 == 0) {
            return
        }
        context.beginPath()
        context.moveTo(x1, y1)
        context.lineTo(x2, y2)
        context.stroke()
    }

    static drawPlusRotLine(context : CanvasRenderingContext2D, size : number, sc1 : number, sc2 : number) {
        const l : number = size / Math.cos(deg)
        for (var j = 0; j < parts; j++) {
            const sf : number = 1 - 2 * j
            const scj : number = ScaleUtil.divideScale(sc2, j, parts)
            context.save()
            context.rotate(deg * sf * scj)
            DrawingUtil.drawLine(context, 0, 0, 0, size * sc1 + (l - size) * scj)
            context.restore()
            context.save()
            context.translate(0, size)
            DrawingUtil.drawLine(context, 0, 0, -size * scj * sf, 0)
            context.restore()
        }
    }

    static drawPLTSNode(context : CanvasRenderingContext2D, i : number, scale : number) {
        const gap : number = w / (nodes + 1)
        const size : number = gap / sizeFactor
        const sc1 : number = ScaleUtil.divideScale(scale, 0, 2)
        const sc2 : number = ScaleUtil.divideScale(scale, 1, 2)
        context.lineCap = 'round'
        context.lineWidth = Math.min(w, h) / strokeFactor
        context.strokeStyle = foreColor
        context.save()
        context.translate(gap * (i + 1), h / 2)
        for (var j = 0; j < lines; j++) {
            const sc1j : number = ScaleUtil.divideScale(sc1, j, lines)
            const sc2j : number = ScaleUtil.divideScale(sc2, j, lines)
            context.save()
            context.rotate(Math.PI/2 * j)
            DrawingUtil.drawPlusRotLine(context, size, sc1j, sc2j)
            context.restore()
        }
        context.restore()
    }
}

class PlusLineSquareStage {

    canvas : HTMLCanvasElement = document.createElement('canvas')
    context : CanvasRenderingContext2D
    renderer : Renderer = new Renderer()

    initCanvas() {
        this.canvas.width = w
        this.canvas.height = h
        this.context = this.canvas.getContext('2d')
        document.body.appendChild(this.canvas)
    }

    render() {
        this.context.fillStyle = backColor
        this.context.fillRect(0, 0, w, h)
        this.renderer.render(this.context)
    }

    handleTap() {
        this.canvas.onmousedown = () => {
            this.renderer.handleTap(() => {
                this.render()
            })
        }
    }

    static init() {
        const stage : PlusLineSquareStage = new PlusLineSquareStage()
        stage.initCanvas()
        stage.render()
        stage.handleTap()
    }
}

class State {
    scale : number = 0
    dir : number = 0
    prevScale : number = 0

    update(cb : Function) {
        this.scale += ScaleUtil.updateValue(this.scale, this.dir, lines, lines * parts)
        if (Math.abs(this.scale - this.prevScale) > 1) {
            this.scale = this.prevScale + this.dir
            this.dir = 0
            this.prevScale = this.scale
            cb()
        }
    }

    startUpdating(cb : Function) {
        if (this.dir == 0) {
            this.dir = 1 - 2 * this.prevScale
            cb()
        }
    }
}

class Animator {

    animated : boolean = false
    interval : number

    start(cb : Function) {
        if (!this.animated) {
            this.animated = true
            this.interval = setInterval(cb, 50)
        }
    }

    stop() {
        if (this.animated) {
            this.animated = false
            clearInterval(this.interval)
        }
    }
}

class PLTSNode {

    prev : PLTSNode
    next : PLTSNode
    state : State = new State()

    constructor(private i : number) {
        this.addNeighbor()
    }

    addNeighbor() {
        if (this.i < nodes - 1) {
            this.next = new PLTSNode(this.i + 1)
            this.next.prev = this
        }
    }

    draw(context : CanvasRenderingContext2D) {
        DrawingUtil.drawPLTSNode(context, this.i, this.state.scale)
        if (this.prev) {
            this.prev.draw(context)
        }
    }

    update(cb : Function) {
        this.state.update(cb)
    }

    startUpdating(cb : Function) {
        this.state.startUpdating(cb)
    }

    getNext(dir : number, cb : Function) : PLTSNode {
        var curr : PLTSNode = this.prev
        if (dir == 1) {
            curr = this.next
        }
        if (curr) {
            return curr
        }
        cb()
        return this
    }
}

class PlusLineToSquare {

    curr : PLTSNode = new PLTSNode(0)
    dir : number = 1

    draw(context : CanvasRenderingContext2D) {
        this.curr.draw(context)
    }

    update(cb : Function) {
        this.curr.update(() => {
            this.curr = this.curr.getNext(this.dir, () => {
                this.dir *= -1
            })
            cb()
        })
    }

    startUpdating(cb : Function) {
        this.curr.startUpdating(cb)
    }
}

class Renderer {

    plts : PlusLineToSquare = new PlusLineToSquare()
    animator : Animator = new Animator()

    render(context : CanvasRenderingContext2D) {
        this.plts.draw(context)
    }

    handleTap(cb : Function) {
        this.plts.startUpdating(() => {
            this.animator.start(() => {
                cb()
                this.plts.update(() => {
                    this.animator.stop()
                })
            })
        })
    }
}
