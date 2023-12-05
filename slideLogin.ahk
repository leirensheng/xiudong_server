#SingleInstance, Force
SendMode Input
SetWorkingDir, %A_ScriptDir%
pid=ahk_pid %1%
title=%2%

curTitle:="a"
moveOne(title){
    WinActivate,%title%
    MouseClickDrag, left, 104, 810,1003,843 ,4
    sleep 1000
    WinGetTitle, titleName, %title%
    return titleName
}

isOk:=false
while(!isOk){
    curTitle:= moveOne(title)
    ToolTip, %curTitle%
    isOk := StrLen(curTitle)==0
}