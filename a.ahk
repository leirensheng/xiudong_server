#SingleInstance, Force
SendMode Input
SetWorkingDir, %A_ScriptDir%
pid=ahk_pid %1%
title=%2%
; 等待程序关闭了
sleep 3000

curTitle:="a"
moveOne(title){
    WinActivate, %title%
    MouseClickDrag, left, 1388, 1196, 2235, 1233, 3
    sleep 500
    WinGetTitle, titleName, %title%
    return titleName
}

isOk:=false
while(!isOk){
    curTitle:= moveOne(title)
    isOk := StrLen(curTitle)==0
}