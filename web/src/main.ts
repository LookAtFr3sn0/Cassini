import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { Unauthorized } from "./api";
import { user } from "./session";

const app = createApp(App);

app.config.errorHandler = (error) => {
    if (error instanceof Unauthorized) {
        user.value = null;
        router.push({ name: "login" });
    } else {
        console.error(error);
    }
};

app.use(router);

app.mount('#app');
