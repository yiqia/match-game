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
  v2,
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
  public x: number = 135; // 初始x坐标

  @property
  public y: number = 1040; // 初始y坐标

  chessBoard: Node[][] = [];

  start() {
    this.generateBoard();
    this.onMove();
  }

  onMove() {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
  }

  // 触摸开始
  onTouchStart(event: EventTouch) {
    console.log("event", event);
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
