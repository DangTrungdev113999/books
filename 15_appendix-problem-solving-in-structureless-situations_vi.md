*[Nguyên lý Kim tự tháp (The Pyramid Principle)](README.md)*

# Phụ lục — Giải quyết vấn đề trong những tình huống thiếu cấu trúc

**Trong chương này:**

- [Suy luận hồi quy phân tích](#suy-luận-hồi-quy-phân-tích)
- [Suy luận hồi quy khoa học](#suy-luận-hồi-quy-khoa-học)
- [Các kỹ thuật giải quyết vấn đề](#các-kỹ-thuật-giải-quyết-vấn-đề)

Chương 8 mô tả việc giải quyết vấn đề như một quá trình logic không khoan nhượng, nhằm phát hiện và phơi bày những cấu trúc nền tảng làm nảy sinh các sự việc mà ta cho là không mong muốn. Lý thuyết của chúng ta cho rằng lời giải của vấn đề luôn nằm ở việc chỉnh sửa cấu trúc — và quả thực sẽ là như vậy nếu vấn đề là ta không hài lòng với kết quả mà cấu trúc đang tạo ra. Tuy nhiên, như tôi đã đề cập, còn một loại tình huống vấn đề khác, trong đó vấn đề không phải là bạn không thích kết quả, mà là bạn không thể giải thích được nó. Bạn không thể giải thích nó vì một trong ba lý do sau:

- Vì cấu trúc đó còn chưa tồn tại — như khi bạn đang cố phát minh ra một thứ gì đó mới (ví dụ: điện thoại, kỹ thuật đào hầm dưới nước).
- Vì cấu trúc đó vô hình — như trong bộ não hay DNA, nên bạn chỉ có thể phân tích kết quả của cấu trúc chứ không thấy được chính nó.
- Vì cấu trúc đó không giải thích được kết quả — như khi định nghĩa về lực của Aristotle không giải thích được động lượng của một viên đạn đại bác, hay khi các công cụ bị gỉ một cách khó hiểu dù bạn làm gì để ngăn chặn đi nữa.

Có thể bạn sẽ gặp phải một trong những tình huống thiếu cấu trúc này ngay trong quá trình thực hiện một nhiệm vụ giải quyết vấn đề thông thường. Mặc dù những tình huống ấy đòi hỏi mức độ tư duy bằng hình ảnh cao hơn những gì ta đã bàn từ trước tới nay, bạn sẽ vui khi biết rằng quá trình suy luận được sử dụng lại rất giống nhau.

Điều cần đến chỉ đơn giản là một hình thức khác của suy luận hồi quy (Abduction — suy luận từ một kết quả quan sát được, đề xuất một nguyên nhân khả dĩ rồi kiểm chứng nó) — một tên gọi do Charles Sanders Peirce đặt ra năm 1890 để mô tả quá trình giải quyết vấn đề. Khi gọi nó là suy luận hồi quy, ông muốn nhấn mạnh mối quan hệ họ hàng giữa lối tư duy giải quyết vấn đề với suy luận diễn dịch (deductive reasoning — đi từ tiền đề tới kết luận "vì vậy") và suy luận quy nạp (inductive reasoning — khái quát từ nhiều sự việc cùng loại). Hãy để tôi giải thích sự khác biệt giữa hai hình thức của suy luận hồi quy, và chỉ cho bạn cách sử dụng hình thức thứ hai.

## Suy luận hồi quy phân tích

Phát hiện sâu sắc của C. S. Peirce là: trong bất kỳ quá trình suy luận nào, bạn cũng luôn làm việc với ba thực thể riêng biệt:

- Một **Quy tắc (Rule)** — một niềm tin về cách mà thế giới được cấu trúc.
- Một **Trường hợp (Case)** — một sự kiện quan sát được tồn tại trong thế giới.
- Một **Kết quả (Result)** — một sự việc được kỳ vọng sẽ xảy ra, khi ta áp dụng Quy tắc vào Trường hợp này.

Cách mà bạn có thể xem mình đang suy luận theo lối nào, tại bất kỳ thời điểm nào, được quyết định bởi việc bạn bắt đầu từ đâu trong quá trình ấy và bạn biết thêm sự kiện nào. Để minh họa cho những khác biệt này:

**Diễn dịch (Deduction)**

| | | |
|---|---|---|
| Quy tắc: | Nếu ta đặt giá quá cao thì doanh số sẽ giảm. | Nếu A thì B |
| Trường hợp: | Ta đã đặt giá quá cao. | A |
| Kết quả: | Vì vậy, tất yếu doanh số sẽ giảm. | Tất yếu B |

**Quy nạp (Induction)**

| | | |
|---|---|---|
| Trường hợp: | Ta đã tăng giá. | A |
| Kết quả: | Doanh số đã giảm. | B |
| Quy tắc: | Lý do doanh số giảm có lẽ là vì giá đã quá cao. | Nếu A thì có lẽ B |

**Suy luận hồi quy (Abduction)**

| | | |
|---|---|---|
| Kết quả: | Doanh số đã giảm. | B |
| Quy tắc: | Một lý do khiến doanh số giảm là giá quá cao. | Nếu A thì B |
| Trường hợp: | Để tôi kiểm tra xem trên thực tế giá có thật sự quá cao không. | Có thể A |

Xuyên suốt cuốn sách, ta vẫn nói rằng giải quyết vấn đề theo lối phân tích bao gồm: nhận ra một Kết quả không mong muốn, tìm nguyên nhân của nó trong hiểu biết của ta về cấu trúc của tình huống (Quy tắc), và kiểm tra xem ta có tìm đúng nguyên nhân hay không (Trường hợp). Bạn có thể thấy điều này khớp chính xác với quá trình suy luận hồi quy trình bày ở trên.

Mặc dù suy luận hồi quy khác với quy nạp và diễn dịch — và sự khác biệt này quan trọng cần lưu ý — chúng cũng có quan hệ mật thiết với nhau. Vì vậy, trong bất kỳ tình huống giải quyết vấn đề phức tạp nào, nhiều khả năng bạn sẽ luân phiên sử dụng cả ba hình thức suy luận. Như tôi đã nói ở phần trước, hình thức bạn đang dùng, và những kết quả bạn có thể trông đợi từ nó, phụ thuộc vào việc bạn bắt đầu từ đâu trong quá trình.

Điểm bạn bắt đầu sẽ quyết định hình thức tư duy bạn sẽ sử dụng:

- **DIỄN DỊCH** — bắt đầu từ Quy tắc.
- **QUY NẠP** — bắt đầu từ Trường hợp.
- **SUY LUẬN HỒI QUY** — bắt đầu từ Kết quả.

*[Sơ đồ: ba điểm xuất phát (Kết quả / Quy tắc / Trường hợp) tương ứng với ba hình thức tư duy.]*

## Suy luận hồi quy khoa học

Khác biệt chính yếu giữa lối giải quyết vấn đề theo phân tích đã bàn ở Chương 8 với lối giải quyết vấn đề được gọi là sáng tạo hay khoa học bàn ở đây là: ta biết cấu trúc tạo ra kết quả của mình, còn nhà khoa học thì không. Nghĩa là ta đã có hai trong số những yếu tố thiết yếu và có thể suy luận để tìm ra yếu tố thứ ba. Còn nhà khoa học thì phải phát minh ra yếu tố thứ hai trước khi có thể suy luận để tìm ra yếu tố thứ ba.

Khi suy luận để tìm ra yếu tố thứ ba, nhà khoa học đi theo phương pháp khoa học cổ điển:

- Đưa ra giả thuyết về một cấu trúc có thể giải thích được kết quả.
- Thiết kế một thí nghiệm có khả năng xác nhận hoặc loại trừ giả thuyết.
- Tiến hành thí nghiệm để có một câu trả lời rõ ràng có-hay-không.
- Lặp lại quy trình, đưa ra các giả thuyết con hoặc các giả thuyết tuần tự để xác định những khả năng còn lại, và cứ thế tiếp tục.

Đặc trưng nổi bật của phương pháp khoa học là việc tạo ra giả thuyết và thiết kế thí nghiệm. Cả hai hoạt động này đều đòi hỏi mức độ tư duy bằng hình ảnh cao.

**1. Tạo ra giả thuyết.** Giả thuyết tưởng như được lấy ra từ hư không, nhưng thực ra được gợi ý trực tiếp từ việc xem xét các yếu tố cấu trúc của tình huống đã sinh ra vấn đề. Chẳng hạn, nếu vấn đề của bạn là muốn tìm một cách để con người giao tiếp với nhau qua những khoảng cách lớn mà không cần phải hét lên, thì bạn sẽ nghĩ một cách cụ thể về những cách để khuếch đại giọng nói hoặc khuếch đại khả năng nghe của tai, và các giả thuyết của bạn sẽ phản ánh những khả năng mà bạn hình dung ra.

Đáng tiếc là, việc bạn hình dung ra những khả năng hữu ích chính xác bằng cách nào lại không phải là điều có thể trình bày thành một công thức nấu ăn. Nó thường đòi hỏi một thứ thiên tài nào đó cho phép bạn nhìn ra những phép loại suy giữa điều bạn biết về vấn đề và điều bạn biết về thế giới. Và quả thực đây chính là điều mà Alexander Graham Bell rõ ràng đã làm khi phát minh ra điện thoại:

> "Tôi chợt nghĩ rằng các xương trong tai người thật ra rất to lớn, đồ sộ, so với cái màng mỏng manh tinh tế điều khiển chúng; và một ý nghĩ nảy ra: nếu một cái màng mỏng manh đến thế lại có thể làm chuyển động những khúc xương tương đối to lớn như vậy, thì cớ gì một miếng màng dày và chắc hơn lại không thể làm chuyển động miếng thép của tôi."

Rõ ràng, ở đây ta chỉ vừa chạm vào phần nổi của một tảng băng rất lớn. Không ai biết điều gì khiến một phép loại suy thích hợp lóe lên trong đầu người này mà không phải người kia. Chắc chắn việc nắm trọn vẹn hiểu biết về tình huống vấn đề có ích, cũng như việc viết ra rồi xem xét lại tất cả các giả định của bạn về nó. Tuy nhiên, điều ta thật sự biết được từ những người đã viết về quá trình này là: tia sáng thấu suốt của họ, một khi đã đến, luôn là một hình ảnh trực quan.

**2. Thiết kế thí nghiệm.** Khi giả thuyết đã được hình thành, bước tiếp theo là dùng nó để gợi ra những thí nghiệm sẽ xác nhận hoặc bác bỏ nó. Một lần nữa, tư duy bằng hình ảnh lại cần đến để có thể tự hỏi: "Nếu cấu trúc này là đúng, thì điều gì sẽ tất yếu xảy ra theo sau? Hãy để tôi dựng một thí nghiệm để chứng minh dứt khoát rằng trên thực tế điều đó quả thật xảy ra." Diễn đạt theo ngôn ngữ của quá trình suy luận hồi quy:

| | |
|---|---|
| Kết quả: | Tôi quan sát thấy sự kiện bất ngờ A. |
| Quy tắc: | A có thể là như vậy vì B là trường hợp đang xảy ra. |
| Trường hợp: | Nếu B đúng là trường hợp đang xảy ra, thì C sẽ tất yếu xảy ra theo sau. Hãy để tôi kiểm tra xem C có thật sự xảy ra theo sau hay không. |

Ta có thể thấy quá trình này rất dễ dàng qua câu chuyện về Galileo và viên đạn đại bác.

| | |
|---|---|
| Kết quả: | Aristotle nói rằng lực là cái sinh ra vận tốc. Từ đó suy ra rằng khi một lực ngừng tác động lên một vật, thì vật ấy phải ngừng chuyển động. Vậy mà nếu tôi bắn một viên đạn ra khỏi nòng đại bác, viên đạn vẫn tiếp tục chuyển động dù lực đã ngừng tác động. Aristotle hẳn đã sai trong quan niệm của ông về lực trong mối liên hệ với chuyển động. |
| Quy tắc: | Tôi có thể quan sát mối quan hệ giữa chuyển động và lực một cách đơn giản bằng cách thả rơi một quả bóng từ tay mình. Khi làm vậy, tôi nhận thấy tình huống chứa ba yếu tố cấu trúc: trọng lượng của quả bóng; quãng đường nó rơi; thời gian nó rơi. Điều này gợi ra ba giả thuyết khác nhau: lực tỷ lệ với trọng lượng của vật mà lực tác động lên; lực tỷ lệ với quãng đường vật di chuyển khi lực tác động; lực tỷ lệ với thời gian lực tác động. |
| Trường hợp: | Nếu giả thuyết 3 đúng, thì quãng đường đi được sẽ tỷ lệ với bình phương của thời gian. Điều này có nghĩa là nếu một vật đi được một đơn vị quãng đường trong một đơn vị thời gian, thì nó phải đi được bốn đơn vị quãng đường trong hai đơn vị thời gian, chín đơn vị quãng đường trong ba đơn vị thời gian, v.v. Hãy để tôi cho một quả bóng lăn xuống mặt nghiêng của một mặt phẳng dốc. Việc này sẽ làm chậm quá trình rơi của nó đủ để tôi đo được những quãng đường đi được trong các đơn vị thời gian khác nhau, và nhờ đó xác định xem mối quan hệ giữa quãng đường và thời gian có đúng như giả thuyết của tôi đã đề ra hay không. |
| Quy tắc mới: | Đúng là như vậy. Vì thế, lực là cái sinh ra sự thay đổi của vận tốc. |

Bí quyết khi thiết kế một thí nghiệm là phải bảo đảm rằng nó sẽ cho ra một câu trả lời dứt khoát, có-hay-không. "Xem thử chuyện gì xảy ra" khi bạn thay đổi điều kiện này hay điều kiện khác trong tình huống là chưa đủ. Kết quả của thí nghiệm phải cho phép bạn khẳng định một cách rõ ràng, không mập mờ, rằng bạn sẽ giữ lại hay loại bỏ giả thuyết.

Chính ở những ngành khoa học áp dụng nghiêm ngặt nhất yêu cầu cụ thể này mà những tiến bộ lớn nhất trong tri thức của ta đã diễn ra trong 50 năm qua. Xin trích lời Charles Darwin: "Thật lạ lùng làm sao khi có người lại không thấy rằng mọi quan sát đều phải ủng hộ hoặc phản bác một quan điểm nào đó, nếu chúng muốn có chút giá trị nào."

Để khép lại phần thảo luận này, tôi đã trình bày cả hai hình thức của suy luận hồi quy ở trang sau. Như bạn có thể thấy, chúng đi theo một khuôn mẫu chung. Đó là một khuôn mẫu có thể mang lại giá trị to lớn trong việc dẫn dắt bạn tạo ra những đột phá nhanh chóng khi suy nghĩ về và giải quyết các vấn đề. Giá trị của nó nằm ở chỗ nó thúc đẩy tư duy của bạn tiến lên một cách chặt chẽ, theo trình tự ít bước nhất, không lề mề và không vướng vào những thứ không liên quan.

Mỗi bước đều đòi hỏi một sản phẩm cuối cùng rõ ràng mà bạn có thể thấy được theo đúng nghĩa đen; mỗi hình ảnh chỉ ra hướng mà các phân tích kế tiếp nên dẫn tới. Khi vấn đề đã được giải quyết, các hình ảnh ấy đóng vai trò như những điểm neo dẫn dắt mạch trình bày và việc lựa chọn từ ngữ của bạn.

Herb Simon nói rằng giải quyết một vấn đề đơn giản nghĩa là biểu diễn nó sao cho lời giải trở nên hiển nhiên. Tôi đã cố gắng giúp bạn hiểu được quá trình mà nhờ đó những cách biểu diễn như vậy có thể được tạo ra và sử dụng một cách hiệu quả nhất. Có lẽ tất cả chúng ta đều có khả năng tư duy sáng tạo và hiệu quả hơn nhiều so với những gì ta đang cố gắng. Một hiểu biết rõ ràng hơn về quá trình ấy có thể sẽ thôi thúc ta thử sức.

## Các kỹ thuật giải quyết vấn đề

| Quá trình cơ bản | Giải quyết vấn đề theo phân tích | Giải quyết vấn đề theo khoa học |
|---|---|---|
| **1. Vấn đề là gì?** | Hình dung sự khác biệt giữa kết quả bạn đang có hiện giờ và kết quả bạn mong muốn. | Xác định sự chênh lệch giữa kết quả bạn đang có và kết quả lẽ ra bạn nên trông đợi theo lý thuyết hiện hành. |
| **2. Vấn đề nằm ở đâu?** | Hình dung các yếu tố cấu trúc trong tình huống hiện tại có thể đang gây ra kết quả đó. | Nêu ra những giả định truyền thống của lý thuyết có thể làm nảy sinh sự chênh lệch. |
| **3. Vì sao vấn đề tồn tại?** | Phân tích từng yếu tố để xác định xem nó có đang gây ra kết quả hay không, và vì sao. | Đưa ra giả thuyết về những cấu trúc thay thế có thể xóa bỏ sự chênh lệch và giải thích được kết quả. |
| **4. Ta có thể làm gì với nó?** | Hình thành những thay đổi thay thế có tính logic có thể tạo ra kết quả mong muốn. | Thiết kế những thí nghiệm sẽ loại trừ một hoặc nhiều giả thuyết. |
| **5. Ta nên làm gì với nó?** | Tạo ra một cấu trúc mới, tích hợp những thay đổi sẽ tạo ra kết quả một cách thỏa đáng nhất. | Tái thiết lập lý thuyết dựa trên các kết quả thí nghiệm. |

---
⬅ [Chương 10. Diễn đạt thành câu chữ dễ đọc](14_chuong-10_putting-it-into-readable-words_vi.md) · [⬆ Mục lục](README.md) · [Tài liệu tham khảo](16_references_vi.md) ➡
