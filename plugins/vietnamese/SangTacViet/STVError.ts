export class STVChapterError extends Error {
  public errorCode: number;
  public raw: any;
  constructor(code: number, detail: any) {
    super(
      `${STVChapterError.getMessage(code)} (code ${code})\n` +
        STVChapterError.stringifyJson(detail),
    );
    this.name = 'STVChapterError';
    this.errorCode = code;
    this.raw = detail;
    Object.setPrototypeOf(this, STVChapterError.prototype);
  }
  get shouldStopRetry(): boolean {
    return STVChapterError.checkStopCode(this.errorCode);
  }
  static checkStopCode(code: number) {
    switch (code) {
      case 0: // OK
      case 1: // empty
      case 12:
      case 13:
      case 15:
      case 18:
      case 19:
      case 21:
      case 101:
        return true;
      default:
        return false;
    }
  }
  static stringifyJson(data: any) {
    try {
      return JSON.stringify(data);
    } catch {
      return `${data}`;
    }
  }
  static getMessage(code: number | string) {
    code = code.toString();
    switch (code) {
      case '1':
        return 'Chương không có nội dung.';
      case '5':
        return 'Lỗi không xác định.';
      case '7':
        return 'Bạn đang tải chương quá nhanh. Hãy thử lại sau vài giây.';
      case '12':
        return 'Bạn chưa mua chương ở sfacg. Đăng nhập để tiếp tục.';
      case '13':
        return 'Bạn chưa đăng nhập.';
      case '15':
        return 'Đang đặt location chuyển hướng.';
      case '18':
        return 'Yêu cầu chuyển hướng.';
      case '19':
        return 'Có lỗi không xác định. Yêu cầu chuyển hướng';
      case '21':
        return 'Bạn cần xác nhận captcha. Hãy thử lại sau vài giây.';
      case '101':
        return 'Truyện này không phải novel (type=manga)';
      default:
        return 'Unexpected response.';
    }
  }
}
