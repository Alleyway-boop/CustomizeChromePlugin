<script setup lang="ts">
import { ref, onMounted, watchEffect } from 'vue';
import { NButton, NIcon, NImage, NModal, NModalProvider, NUpload, NUploadDragger, UploadFileInfo, UploadSettledFileInfo } from 'naive-ui';
import browser from 'webextension-polyfill';

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
const background = ref<string>();
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
const showModal = ref(false);
const previewFileList = ref<UploadFileInfo[]>()
const previewImageUrl = ref<string>()
const showPreview = ref(false)
watchEffect(() => {
    console.log('previewFileList:', previewFileList.value)
})
function handleFinish({ file, event }: {
    file: UploadSettledFileInfo;
    event?: ProgressEvent;
}) {
    SaveBackgroundImage(file);
}
function SaveBackgroundImage(file: UploadSettledFileInfo) {
    const reader = new FileReader()
    reader.onload = (e) => {
        const base64 = e.target?.result
        browser.storage.local.set({ "backgroundImage": base64 })
        background.value = base64 as string
        document.body.style.backgroundImage = `url(${background.value})`
        document.body.style.backgroundSize = 'cover'
        showModal.value = false
    }
    reader.readAsDataURL(file.file!)
}
onMounted(() => {
    browser.storage.local.get('backgroundImage').then((result) => {
        if (result.backgroundImage) {
            background.value = result.backgroundImage
            document.body.style.backgroundImage = `url(${background.value})`
            document.body.style.backgroundSize = 'cover'
        }
    })
})
</script>

<template>
    <div class="flex justify-center items-center text-center font-bold text-white" @click="BackSource">
        <div>
            <img src="/icon-with-shadow.svg" alt="Icon" />
            <h1>{{ title || 'vite-plugin-web-extension' }}</h1>
            <p>
                Template: <code>vue-ts</code>
            </p>
            <NButton class="" @click.stop="showModal = !showModal">上传自定义背景</NButton>
        </div>
        <NModal v-model:show="showModal" class="max-w-30%">
            <NUpload :max="1" :default-file-list="previewFileList" list-type="image" file-list-class="bg-white"
                action="" @finish="handleFinish">
                <NUploadDragger>
                    <div style="margin-bottom: 12px">
                        <NIcon size="48" :depth="3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                                <path fill="#888888"
                                    d="M4 22v-2h16v2zm5-4v-7H5l7-9l7 9h-4v7zm2-2h2V9h1.9L12 5.25L9.1 9H11zm1-7"></path>
                            </svg>
                        </NIcon>
                    </div>
                    <n-text style="font-size: 16px">
                        点击或者拖动文件到该区域来上传
                    </n-text>
                </NUploadDragger>
            </NUpload>
        </NModal>
    </div>
</template>

<style>
* {
    user-select: none;
}
h1, p {
    mix-blend-mode: difference;
}
</style>
