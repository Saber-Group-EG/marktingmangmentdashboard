import Swal from "sweetalert2";

// Get the current theme (dark/light) from the DOM
const isDarkMode = () => document.documentElement.classList.contains("dark");

// Custom Swal configuration matching project colors
export const showAlert = (message: string, type: "success" | "error" | "warning" | "info" = "info") => {
    const dark = isDarkMode();

    // Color configurations based on your theme
    const colors = {
        success: dark ? "#22a4b5" : "#e42e2b",
        error: dark ? "#f43f3f" : "#e42e2b",
        warning: dark ? "#ff8a7a" : "#e87c78",
        info: dark ? "#45c8d6" : "#c45a56",
    };

    const bgColor = dark ? "#171717" : "#ffffff";
    const textColor = dark ? "#e5e5e5" : "#0a0a0a";
    const iconColor = colors[type];

    const useHtml = message.includes("<br>");
    const content: any = useHtml ? { html: message } : { text: message };

    return Swal.fire({
        ...content,
        icon: type,
        iconColor: iconColor,
        background: bgColor,
        color: textColor,
        confirmButtonColor: iconColor,
        confirmButtonText: "OK",
        customClass: {
            popup: "rounded-lg shadow-xl",
            confirmButton: "px-6 py-2 rounded-md font-medium",
        },
    });
};

// Confirmation dialog
export const showConfirm = async (message: string, confirmText: string = "Yes", cancelText: string = "No"): Promise<boolean> => {
    const dark = isDarkMode();
    const bgColor = dark ? "#171717" : "#ffffff";
    const textColor = dark ? "#e5e5e5" : "#0a0a0a";
    const confirmColor = dark ? "#f43f3f" : "#e42e2b";
    const cancelColor = dark ? "#525252" : "#a3a3a3";

    const result = await Swal.fire({
        text: message,
        icon: "question",
        iconColor: dark ? "#45c8d6" : "#c45a56",
        background: bgColor,
        color: textColor,
        showCancelButton: true,
        confirmButtonColor: confirmColor,
        cancelButtonColor: cancelColor,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        customClass: {
            popup: "rounded-lg shadow-xl",
            confirmButton: "px-6 py-2 rounded-md font-medium",
            cancelButton: "px-6 py-2 rounded-md font-medium",
        },
    });

    return result.isConfirmed;
};

// Toast notification (small, auto-dismiss)
export const showToast = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    const dark = isDarkMode();
    const colors = {
        success: dark ? "#22a4b5" : "#e42e2b",
        error: dark ? "#f43f3f" : "#e42e2b",
        warning: dark ? "#ff8a7a" : "#e87c78",
        info: dark ? "#45c8d6" : "#c45a56",
    };

    const bgColor = dark ? "#262626" : "#ffffff";
    const textColor = dark ? "#e5e5e5" : "#0a0a0a";

    return Swal.fire({
        toast: true,
        position: "top-end",
        icon: type,
        iconColor: colors[type],
        title: message,
        background: bgColor,
        color: textColor,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        customClass: {
            popup: "rounded-lg shadow-xl",
        },
    });
};
