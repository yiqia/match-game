import {
  _decorator,
  Animation,
  AudioSource,
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

  @property({ type: Prefab })
  public bom: Prefab; // 爆炸资源
  @property({ type: Prefab })
  public clickLight: Prefab; // 点击灯光资源

  chessBoard: Node[][] = [];
  swapBeforeIndex: number[] = null; // 交换之前下标
  swapAfterIndex: number[] = null; // 交换之后的下标
  startTouchPos: Vec2 = null;
  isSwap = false; // 是否交换中
  audios: { [key: string]: AudioSource } = {};

  onLoad(): void {
    const audios = {};
    this.node.getComponents(AudioSource).forEach((item) => {
      audios[item.clip.name] = item;
    });
    this.audios = audios;
  }

  start() {
    this.generateBoard();
    this.onMove();
  }

  onMove() {
    input.on(Input.EventType.TOUCH_START, this.onBoardTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onBoardTouchMove, this);
  }

  reset() {
    this.startTouchPos = null;
    this.swapBeforeIndex = null;
    this.swapAfterIndex = null;
    this.isSwap = false;
    this.chessBoard = [];
    this.node.removeAllChildren();
    this.generateBoard();
  }

  // 触摸开始
  onBoardTouchStart(event: EventTouch) {
    this.audios["drop"].play();
    // 获取鼠标按下的位置
    this.startTouchPos = event.getUILocation();
    // 根据鼠标按下的位置找到对应的棋子
    this.swapBeforeIndex = this.getPieceAtPosition(this.startTouchPos);

    if (!this.swapBeforeIndex) return;
    const [row, col] = this.swapBeforeIndex;

    // 设置点击灯光
    this.setClickLight(row, col);

    // 设置点击动效
    this.setClickPiecesAni(row, col);
  }

  onBoardTouchMove(event: EventTouch) {
    if (!this.swapBeforeIndex) return;
    const target = this.getSwappingPieces(event);
    const [row, col] = this.swapBeforeIndex;
    if (target) {
      this.closeLight();
      this.swapPiece([row, col], target, (isSame: boolean) => {
        if (isSame) {
          this.swapPiece([row, col], target);
        } else {
          const isMatch = this.checkAndRemoveMatchesAt([[row, col], target]);
          if (!isMatch) this.swapPiece([row, col], target);
        }
      });
      this.swapBeforeIndex = null;
    }
  }

  setClickPiecesAni(row: number, col: number) {
    const animation = this.chessBoard[row][col].getComponent(Animation);
    animation.play();
  }

  // 设置点击灯
  setClickLight(row: number, col: number) {
    const [x, y] = this.getPiecePosition(row, col);
    const item = this.node.getChildByName("click-light");
    if (item) {
      item.setPosition(x, y);
      item.active = true;
    } else {
      const light = instantiate(this.clickLight);
      light.setPosition(x, y);
      light.active = true;
      this.node.addChild(light);
    }
  }

  // 熄灭灯光
  closeLight() {
    const light = this.node.getChildByName("click-light");
    light.active = false;
  }

  // 加载爆炸特效
  playBom(row: number, col: number) {
    const [x, y] = this.getPiecePosition(row, col);
    const bom = instantiate(this.bom);
    bom.setPosition(x, y);
    this.node.addChild(bom);
    bom.getComponent(Animation).play();
    setTimeout(() => {
      bom.destroy();
    }, 100);
  }

  /**
   * 检查消除
   * @param {[number,number][]} pos  // 检查坐标
   */
  checkAndRemoveMatchesAt(pos): boolean {
    let matches = [];
    for (let [row, col] of pos) {
      // 横向匹配
      let cols = this.checkMatch(row, col, true);
      // 纵向匹配
      let rows = this.checkMatch(row, col, false);
      matches = matches.concat(cols, rows);
    }
    if (matches.length < 1) return;
    const audioNum = matches.length > 6 ? 6 : matches.length;
    this.audios[`eliminate${audioNum}`].play();
    // 消除
    for (let [row, col] of matches) {
      this.node.removeChild(this.chessBoard[row][col]);
      this.playBom(row, col);
      this.chessBoard[row][col] = null;
    }
    const movedPos = [...this.movePiecesDown(), ...this.refillAndCheck()];
    if (movedPos.length > 0) {
      this.checkAndRemoveMatchesAt(movedPos);
    }
    return true;
  }

  /**
   * 检查单个棋子
   * @param {number} row  行
   * @param {number} col  列
   * @param {boolean} horizontal  平行
   */
  checkMatch(row, col, horizontal) {
    const matches = [[row, col]];
    const current = this.chessBoard[row][col].name;
    let i = 1;
    if (horizontal) {
      // 往左遍历
      while (col - i >= 0 && this.chessBoard[row][col - i].name === current) {
        matches.push([row, col - i]);
        i++;
      }
      i = 1;
      // 往右遍历
      while (
        col + i < this.chessBoard[row].length &&
        this.chessBoard[row][col + i].name === current
      ) {
        matches.push([row, col + i]);
        i++;
      }
    } else {
      // 往上
      while (row - i >= 0 && this.chessBoard[row - i][col].name === current) {
        matches.push([row - i, col]);
        i++;
      }
      i = 1;
      // 往下
      while (
        row + i < this.chessBoard.length &&
        this.chessBoard[row + i][col].name === current
      ) {
        matches.push([row + i, col]);
        i++;
      }
    }
    return matches.length >= 3 ? matches : [];
  }

  /**
   * 重新填充和检查棋子
   */
  refillAndCheck() {
    const movedPos = [];
    for (let row = 0; row < this.chessBoard.length; row++) {
      for (let col = 0; col < this.chessBoard[row].length; col++) {
        if (this.chessBoard[row][col] === null) {
          this.chessBoard[row][col] = this.generatePiece(-(row + 1), col);
          movedPos.push([row, col]);
          this.downAnimation(
            this.chessBoard[row][col],
            this.getPiecePosition(row, col)
          );
        }
      }
    }
    return movedPos;
  }

  /**
   * 向下移动棋子
   */
  movePiecesDown() {
    const movedPos = [];
    for (let col = this.chessBoard[0].length - 1; col >= 0; col--) {
      let nullCount = 0;
      for (let row = this.chessBoard.length - 1; row >= 0; row--) {
        const piece = this.chessBoard[row][col];
        if (piece === null) {
          nullCount++;
        } else if (nullCount > 0) {
          this.downAnimation(
            this.chessBoard[row][col],
            this.getPiecePosition(row + nullCount, col)
          );
          this.chessBoard[row + nullCount][col] = this.chessBoard[row][col];
          this.chessBoard[row][col] = null;
          movedPos.push([row + nullCount, col]);
        }
      }
    }
    return movedPos;
  }

  swapPiece(
    [row1, col1]: number[],
    [row2, col2]: number[],
    callback?: (isSame: boolean) => void
  ) {
    if (!this.chessBoard[row1][col1] || !this.chessBoard[row2][col2]) return;
    this.audios["swap"].play();
    this.isSwap = true;
    const temp = this.chessBoard[row1][col1];
    this.chessBoard[row1][col1] = this.chessBoard[row2][col2];
    this.chessBoard[row2][col2] = temp;
    this.swapAnimation(
      this.chessBoard[row1][col1],
      this.chessBoard[row2][col2],
      () => {
        this.isSwap = false;
        if (
          this.chessBoard[row1][col1].name === this.chessBoard[row2][col2].name
        ) {
          callback?.(true);
        } else {
          callback?.(false);
        }
      }
    );
  }

  // 下坠动画
  downAnimation(node: Node, [x, y]: number[], callback?: () => void) {
    // 锁住不然动画过程中操作会出现异常
    this.isSwap = true;
    tween(node)
      .to(0.2, { position: new Vec3(x, y) })
      .call(() => {
        this.isSwap = false;
        callback?.();
      })
      .start();
  }

  // 交换动画
  swapAnimation(a: Node, b: Node, callback?: () => void) {
    if (!a || !b) return;
    const speed = 0.2;
    const aPos = new Vec3(a.position.x, a.position.y);
    const bPos = new Vec3(b.position.x, b.position.y);

    const swapAPromise = new Promise((resolve) => {
      tween(a)
        .to(speed, { position: bPos })
        .call(() => {
          resolve(true);
        })
        .start();
    });

    const swapBPromise = new Promise((resolve) => {
      tween(b)
        .to(speed, { position: aPos })
        .call(() => {
          resolve(true);
        })
        .start();
    });

    Promise.allSettled([swapAPromise, swapBPromise]).then(() => {
      callback?.();
    });
  }

  // 获取需要交换的棋子下标
  getSwappingPieces(event: EventTouch): number[] | null {
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
