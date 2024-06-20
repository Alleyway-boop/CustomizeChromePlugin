<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NButton } from 'naive-ui';
import Browser from 'webextension-polyfill';

// 获取当前页面的完整 URL
const FullPath = window.location.href;

// 从 FullPath 中提取出当前页面的路径
const Path = FullPath.split('/').pop();
console.log('FullPath:', FullPath);
console.log('Path:', Path);

// 解析 URL 参数
const urlParams = new URLSearchParams(window.location.search);
const title = ref<string>(urlParams.get('title')!);
const url = ref<string>(urlParams.get('url')!);
const icon = ref<string>(urlParams.get('icon')!);

// 设置当前页面的标题和图标
onMounted(() => {
    if (title.value) {
        document.title = title.value;
    } else {
        document.title = 'Options';
    }

    if (icon.value) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = icon.value;
        document.head.appendChild(link);
    }
    console.log('Title:', title.value);
    console.log('URL:', url.value);
    console.log('Icon:', icon.value);
});
function BackSource() {
    window.location.href = url.value;
    console.log('Back to Source:', url.value);
}
</script>

<template>
    <div class="container" @click="BackSource">
        <div>
            <img src="/icon-with-shadow.svg" alt="Icon" />
            <h1>{{ title || 'vite-plugin-web-extension' }}</h1>
            <p>
                Template: <code>vue-ts</code>
            </p>
        </div>
    </div>
</template>

<style scoped>
.container {
    display: -webkit-box;
    display: -ms-flexbox;
    display: -webkit-flex;
    display: flex;
    -webkit-box-pack: center;
    -ms-flex-pack: center;
    -webkit-justify-content: center;
    justify-content: center;
    -webkit-box-align: center;
    -ms-flex-align: center;
    -webkit-align-items: center;
    align-items: center;
    -ms-flex-line-pack: center;
    -webkit-align-content: center;
    align-content: center;
    text-align: center;
}
</style>
