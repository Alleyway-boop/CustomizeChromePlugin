package main

import (
	"fmt"
	"syscall"
	"unsafe"
)

func main() {
	GetDiskSize()
}

func GetDiskSize() {

	/**
	  获取磁盘空间
	*/
	// 磁盘
	diskName := "C:"
	diskNameUtf16Ptr, _ := syscall.UTF16PtrFromString(diskName)
	// 一下参数类型需要跟API 的类型相符
	lpFreeBytesAvailable, lpTotalNumberOfBytes,
		lpTotalNumberOfFreeBytes := int64(0), int64(0), int64(0)

	// 获取方法引用
	kernel32, err := syscall.LoadLibrary("kernel32.dll")
	if err != nil {
		panic("获取方法引用失败:")
	}
	// 释放引用
	defer func(handle syscall.Handle) {
		err := syscall.FreeLibrary(handle)
		if err != nil {
			panic("释放引用失败")
		}
	}(kernel32)

	getDisFreeSpaceEx, err := syscall.GetProcAddress(kernel32, "GetDiskFreeSpaceExW")
	if err != nil {
		panic("失败1")
	}

	// 根据参数个数使用对象SyscallN方法, 只需要4个参数
	r, _, errno := syscall.SyscallN(getDisFreeSpaceEx,
		uintptr(unsafe.Pointer(diskNameUtf16Ptr)), //
		uintptr(unsafe.Pointer(&lpFreeBytesAvailable)),
		uintptr(unsafe.Pointer(&lpTotalNumberOfBytes)),
		uintptr(unsafe.Pointer(&lpTotalNumberOfFreeBytes)),
		0, 0)
	// 此处的errno不是error接口， 而是type Errno uintptr
	// MSDN GetDiskFreeSpaceEx function 文档说明：
	// Return value
	// 		If the function succeeds, the return value is nonzero.
	// 		If the function fails, the return value is zero (0). To get extended error information, call GetLastError.
	// 只要是0 就是错误
	if r != 0 {
		fmt.Printf("剩余空间 %d G.\n", lpFreeBytesAvailable/1024/1204/1024)
		fmt.Printf("用户可用总空间 %d G.\n", lpTotalNumberOfBytes/1024/1204/1024)
		fmt.Printf("剩余空间2 %d G.\n", lpTotalNumberOfFreeBytes/1024/1204/1024)
	} else {
		fmt.Println("失败2")
		panic(errno)
	}
	//	创建一个窗口
	//user32 := syscall.NewLazyDLL("user32.dll")
	//messageBox := user32.NewProc("MessageBoxW")
	//	调用MessageBoxW
	//	第一个参数是窗口句柄，这里用0代表是调用MessageBoxW函数创建的窗口
	//	第二个参数是内容
	//	第三个参数是标题
	//	第四个参数是按钮样式
	//	返回值是被按下的按钮的ID
	//ret, _, _ := messageBox.Call(0,
	//	uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr("Hello World"))),
	//	uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr("Hello Message Box"))),
	//	uintptr(0))
	//fmt.Printf("The return value is %d\n", ret)
}
