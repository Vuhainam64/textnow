/**
 * taskQueue.js - Hàng đợi tác vụ đa luồng
 * -----------------------------------------
 * Quản lý việc chạy nhiều tác vụ tự động hoá song song (concurrent).
 * Mỗi tác vụ được giao một profile Multilogin và một proxy riêng.
 *
 * Cơ chế:
 * 1. addTask(task) : Thêm tác vụ vào hàng đợi
 * 2. start()       : Bắt đầu xử lý song song (tối đa concurrency luồng)
 * 3. stop()        : Dừng nhận tác vụ mới
 *
 * Ví dụ sử dụng:
 *   const queue = new TaskQueue(5); // 5 luồng đồng thời
 *   queue.addTask(async () => { ... });
 *   queue.start();
 */

export class TaskQueue {
    /**
     * @param {number} concurrency - Số luồng chạy đồng thời tối đa
     */
    constructor(concurrency = 3) {
        this.concurrency = concurrency; // Số luồng tối đa
        this.queue = [];                // Hàng đợi tác vụ chờ
        this.running = 0;               // Số tác vụ đang chạy
        this.stopped = false;           // Trạng thái dừng
    }

    /**
     * Thêm một tác vụ vào hàng đợi
     * @param {Function} task - Hàm async cần thực thi
     * @returns {Promise} - Promise khi tác vụ hoàn thành
     */
    addTask(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this._processNext();
        });
    }

    /**
     * Xử lý tác vụ tiếp theo trong hàng đợi
     * @private
     */
    _processNext() {
        if (this.stopped || this.running >= this.concurrency || this.queue.length === 0) return;

        const { task, resolve, reject } = this.queue.shift();
        this.running++;

        Promise.resolve()
            .then(() => task())
            .then(resolve)
            .catch(reject)
            .finally(() => {
                this.running--;
                this._processNext(); // Tự động lấy tác vụ tiếp theo
            });
    }

    /** Dừng hàng đợi (không chấp nhận tác vụ mới) */
    stop() {
        this.stopped = true;
    }

    /** Tiếp tục hàng đợi */
    resume() {
        this.stopped = false;
        this._processNext();
    }

    /** Trạng thái hiện tại */
    get status() {
        return {
            running: this.running,
            pending: this.queue.length,
            concurrency: this.concurrency,
        };
    }
}
