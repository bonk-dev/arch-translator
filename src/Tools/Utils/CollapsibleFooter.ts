export function makeCollapsibleFooter($content: JQuery, $toggler: JQuery, storeKey: string) {
    // we have to reimplement the collapsible list, because the original code is inside an anonymous function

    const collapsedVal = '0';
    const expandedVal = '1';

    // @ts-ignore mw is MediaWiki API
    const isCollapsed = mw.storage.get( storeKey ) !== expandedVal;

    // Style the toggler with an arrow icon and add a tabIndex and a role for accessibility
    $toggler
        .addClass('mw-editfooter-toggler')
        .prop('tabIndex', 0)
        .attr('role', 'button');

    // @ts-ignore makeCollapsible is from a MediaWiki plugin
    $content.makeCollapsible( {
        $customTogglers: $toggler,
        linksPassthru: true,
        plainMode: true,
        collapsed: isCollapsed
    } );

    $toggler.addClass(isCollapsed
        ? 'mw-icon-arrow-collapsed'
        : 'mw-icon-arrow-expanded');

    $content.on('beforeExpand.mw-collapsible', () => {
        $toggler
            .removeClass('mw-icon-arrow-collapsed')
            .addClass('mw-icon-arrow-expanded');

        // @ts-ignore mw is MediaWiki API
        mw.storage.set(storeKey, expandedVal);
    } );

    $content.on('beforeCollapse.mw-collapsible', () => {
        $toggler
            .removeClass('mw-icon-arrow-expanded')
            .addClass('mw-icon-arrow-collapsed');

        // @ts-ignore mw is MediaWiki API
        mw.storage.set(storeKey, collapsedVal);
    } );
}