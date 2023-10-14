import {
  _decorator,
  BoxCollider2D,
  Component,
  EventTouch,
  Input,
  input,
  instantiate,
  Node,
  PhysicsSystem2D,
  Prefab,
  tween,
  UITransform,
  v2,
  v3,
  Vec2,
  Vec3,
} from "cc";
const { ccclass, property } = _decorator;

@ccclass("ContentControl")
export class ContentControl extends Component {
  @property({ type: [Prefab] })
  public chessPieces: Prefab[] = []; // 棋子预设

  @property
  public boardWidth: number = 6; // 棋盘宽度（列数）

  @property
  public boardHeight: number = 6; // 棋盘高度（行数）

  @property
  public spacing: number = 96; // 棋盘元素之间的间距

  @property
  public x: number = -240; // 初始x坐标

  @property
  public y: number = 240; // 初始y坐标

  chessBoard: Node[][] = [];
  swapBeforeIndex: number[] = null; // 交换之前下标
  swapAfterIndex: number[] = null; // 交换之后的下标
  startTouchPos: Vec2 = null;
  isTouchMove: boolean = false;
  isSwap = false; // 是否交换中

  start() {
    this.generateBoard();
    this.onMove();
  }

  onMove() {
    input.on(Input.EventType.TOUCH_START, this.onBoardTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onBoardTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onBoardTouchEnd, this);
  }

  // 触摸开始
  onBoardTouchStart(event: EventTouch) {
    // 获取鼠标按下的位置
    this.startTouchPos = event.getUILocation();
    // 根据鼠标按下的位置找到对应的棋子
    this.swapBeforeIndex = this.getPieceAtPosition(this.startTouchPos);
  }

  onBoardTouchMove(event: EventTouch) {
    const target = this.getSwappingPieces(event);
    console.log(target);
    if (target) {
      this.swapPiece(this.swapBeforeIndex, target);
      this.swapBeforeIndex = null;
    }
  }

  onBoardTouchEnd() {
    this.isTouchMove = false;
  }

  swapPiece([row1, col1]: number[], [row2, col2]: number[]) {
    this.isSwap = true;
    const temp = this.chessBoard[row1][col1];
    this.chessBoard[row1][col1] = this.chessBoard[row2][col2];
    this.chessBoard[row2][col2] = temp;
    console.log();
    console.log("交换后", this.chessBoard);
    this.swapAnimation(
      this.chessBoard[row1][col1],
      this.chessBoard[row2][col2],
      () => {
        this.isSwap = false;
      }
    );
  }

  // 交换动画
  swapAnimation(a: Node, b: Node, callback?: () => void) {
    if (!a || !b) return;
    const speed = 0.2;
    Promise.all([
      new Promise((resolve) => {
        tween(a)
          .to(speed, { position: new Vec3(b.position.x, b.position.y) })
          .call(() => {
            resolve(true);
          })
          .start();
      }),
      new Promise((resolve) => {
        tween(b)
          .to(speed, { position: new Vec3(a.position.x, a.position.y) })
          .call(() => {
            resolve(true);
          })
          .start();
      }),
    ]).then(() => {
      callback?.();
    });
  }

  // 获取需要交换的棋子下标
  getSwappingPieces(event: EventTouch) {
    if (!this.startTouchPos || !event || !this.swapBeforeIndex || this.isSwap) {
      return null;
    }

    let target = null;
    const [row, col] = this.swapBeforeIndex;
    const threshold = 50; // 移动阈值
    const { x: startX, y: startY } = this.startTouchPos;
    const { x: moveX, y: moveY } = event.getUILocation();
    const diffX = moveX - startX;
    const diffY = moveY - startY;

    // 判断左右
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > threshold) {
        target = [row, col + 1];
      } else if (diffX < -threshold) {
        target = [row, col - 1];
      }
    } else {
      if (diffY > threshold) {
        target = [row - 1, col];
      } else if (diffY < -threshold) {
        target = [row + 1, col];
      }
    }

    // 边界判断
    if (!this.isWithinBounds(target, this.boardWidth, this.boardHeight)) {
      return null;
    }

    return target;
  }

  // 检查目标位置是否在棋盘边界内
  isWithinBounds(target, boardWidth, boardHeight) {
    return (
      target &&
      target[0] >= 0 &&
      target[0] < boardHeight &&
      target[1] >= 0 &&
      target[1] < boardWidth
    );
  }

  getPieceAtPosition(pos: Vec2 | null): number[] {
    /**
     * 1. 获取当前棋盘节点
     * 2. 遍历子节点，将点击的点坐标转换到当前棋盘节点坐标系中
     * 3. 判断子节点盒子是否包含点击的节点
     */
    // 获取当前棋盘节点
    const uiTransform = this.node.getComponent(UITransform);

    if (!uiTransform) return;

    // 转换当前棋盘坐标系
    const { x, y } = uiTransform.convertToNodeSpaceAR(v3(pos.x, pos.y));

    // 遍历坐标 查看该棋子是否包含了点击的点
    for (let row = 0; row < this.chessBoard.length; row++) {
      for (let col = 0; col < this.chessBoard[row].length; col++) {
        const piece = this.chessBoard[row][col];
        const box = piece?.getComponent(UITransform).getBoundingBox();
        if (box?.contains(v2(x, y))) {
          return [row, col];
        }
      }
    }
    return;
  }

  generateBoard() {
    // 创建空节点
    this.chessBoard = Array.from({ length: this.boardHeight }, () =>
      Array.from({ length: this.boardWidth }, () => null)
    );
    for (let i = 0; i < this.boardHeight; i++) {
      for (let j = 0; j < this.boardWidth; j++) {
        this.chessBoard[i][j] = this.generatePiece(i, j);
      }
    }
  }

  /**
   * 根据i和j创建棋子
   */
  generatePiece(i: number, j: number) {
    const piece = this.getRandomChessPiece();
    const [x, y] = this.getPiecePosition(i, j);
    piece.setPosition(x, y);
    this.node.addChild(piece);
    return piece;
  }

  // 根据i，j获取坐标
  getPiecePosition(i: number, j: number): number[] {
    return [this.x + j * this.spacing, this.y - i * this.spacing];
  }

  // 在棋盘脚本中编写一个方法，用于随机选择一个棋子预制件
  getRandomChessPiece(): Node {
    // 生成一个随机数，范围为 [0, 棋子预制件数组的长度)
    const randomIndex = Math.floor(Math.random() * this.chessPieces.length);
    // 使用随机数作为索引，从数组中选择一个棋子预制件
    const randomChessPiece = this.chessPieces[randomIndex];
    const piece = instantiate(randomChessPiece);
    return piece;
  }
  update(deltaTime: number) {}
}
