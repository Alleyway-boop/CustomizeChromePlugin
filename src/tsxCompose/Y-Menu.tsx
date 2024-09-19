import { defineComponent } from "vue";

export default defineComponent({
    setup() {
        return () => (
            <div class="container">
                <h1 class="title">TSX Compose Demo</h1>
                <p class="description">This is a demo of TSX Compose.</p>
            </div>
        );
    },
});