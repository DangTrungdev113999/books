/**
 * Watermark / chữ ký tác giả ở góc dưới-trái canvas. Con dấu monogram "ĐTT" +
 * tên chữ serif nghiêng — tinh tế, sang trọng, không chắn thao tác (pointer-events: none).
 */
export function Watermark() {
  return (
    <div className="watermark" aria-hidden="true">
      Đặng Thế Trung
    </div>
  );
}
