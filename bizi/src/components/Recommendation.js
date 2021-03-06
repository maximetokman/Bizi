import React from 'react'
import environmentImg from '../images/sustainability.png';
import placeholderImg from '../images/pexels-mariana-kurnyk-1775043.jpg';
import businessImg from '../images/pexels-ksenia-chernaya-3965557.jpg'
import heartImg from '../images/ethical.png';
import diversityImg from '../images/diversity.png';
import communityImg from '../images/community_engagement.png';
import * as queries from '../graphql/queries'
import * as mutations from '../graphql/mutations'
import { API, Auth, Storage } from 'aws-amplify'
import Loader from 'react-loader-spinner'
import { withRouter } from 'react-router-dom'

class Recommendation extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            recommendationIDs: [],
            businesses: [],
            recommendations: [],
            loading: false
        }
    }

    getImgUrl = async(path) => {
        try {
          var url = await Storage.get(path,
            { level: 'public' });
            return url;
          }
        catch(e) {
          console.log(e);
        }
      }

    generateRecommendations = async() => {
        const { recommendationIDs, businesses } = this.state;
        console.log(recommendationIDs);
        var recommendationBusinesses = recommendationIDs.map((id) => {
            return businesses.filter((item) => item?.id == id)[0];
        });

        var iconOrder = ["Sustainability", "Ethical Supply Chain", "Diversity Initiatives", "Community Engagement"];

        var iconDict = {
            'Sustainability': {
              id: 'searchEnvironment',
              img: environmentImg
            },
            'Ethical Supply Chain': {
              id: 'searchHeart',
              img: heartImg
            },
            'Diversity Initiatives': {
              id: 'searchCommunity',
              img: diversityImg
            },
            'Community Engagement': {
                id: 'searchCommunity',
                img: communityImg
              }
        };

        console.log(recommendationBusinesses);
        
        var recommendationList = await Promise.all(recommendationBusinesses.map(async(item, index) => {
            var background = item?.imgPath ? await this.getImgUrl(item?.imgPath) : null;
            return (
                <div 
                    className='recItem' 
                    style={{backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${background ? background : placeholderImg})`}}
                    onClick={() => this.props.history.push({pathname: `/search/${item?.id}`, state: {business: item}})}
                    key={index}
                    >
                    <h1>{item?.businessName}</h1>
                    <div className='recImgs'>
                        {iconOrder.map((init, index) =>
                          item?.initiatives?.includes(init) ?
                            <img className={iconDict[init]?.id} title={init} src={iconDict[init]?.img} key={index}/> :
                            null
                        )}
                    </div>
                </div>
        )}));
        this.setState({
            recommendations: recommendationList,
            loading: false
        });
    }

    invokeRecommendationLambda = async() => {
        this.setState({
            loading: true
        });
        var businesses = [];
        // get list of businesses
        try {
            var businessQuery = await API.graphql({
                query: queries.listBusinesss,
                variables: {limit: 1000}
            });
            businesses = businessQuery?.data?.listBusinesss?.items;
        }
        catch (error) {
            console.log(error);
        }
        businesses = businesses.filter((item) => item.approved);
        this.setState({
            businesses: businesses
        });
        console.log(businesses);

        // get current user, if any
        try {
            var currUser = await Auth.currentAuthenticatedUser();
        }
        catch (error) {
            console.log(error);
        }
        console.log(currUser);

        var userPreferences;
        if (!currUser) {
            userPreferences = []
        }
        // get user preferences if user exists
        else {
            var userEmail = currUser?.attributes?.email;
            try {
                var userQuery = await API.graphql({
                    query: queries.getUser,
                    variables: {userEmail: userEmail}
                });
            }
            catch (error) {
                console.log(error);
            }
            userPreferences = userQuery?.data?.getUser?.userPreferences;
        }
        // get business attributes
        var businessAttributes = [];
        for (var index in businesses) {
            var business = [businesses[index]?.id];
            business = business.concat(businesses[index]?.initiatives);
            businessAttributes.push(JSON.stringify(business));
        }
        
        // call lambda function
        try {
            var recommendationIDs = await API.graphql({
                query: mutations.recommend,
                variables: {preferences: userPreferences, attributes: businessAttributes}
            });
        }
        catch (error) {
            console.log(error);
        }
        console.log(recommendationIDs);
        this.setState({
            recommendationIDs: recommendationIDs?.data?.recommend
        });
    }

    async componentDidMount() {
        await this.invokeRecommendationLambda();
        this.generateRecommendations();
    }

    render() {
        const { loading, recommendations } = this.state;

        return(
            <div className="recs">
                <h1>Recommended for you</h1>
                {loading ? <Loader type='TailSpin' color='white' height={40} /> :
                <div className="recItems">
                    {recommendations}
                </div>
                }
            </div>
        )
    }
}

export default withRouter(Recommendation);