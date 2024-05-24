export const injectCssCode = (cssCode: string) => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = cssCode;
    document.head.appendChild(styleElement);
};